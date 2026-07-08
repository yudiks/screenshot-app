// windowrec — record a single macOS window to an MP4 (H.264) using ScreenCaptureKit.
//
// Usage:  windowrec /path/to/output.mp4
//
// Flow:
//   1. Present the native ScreenCaptureKit window picker (single window).
//   2. On selection, stream the window's frames into an AVAssetWriter.
//   3. On SIGINT/SIGTERM, finalize the MP4 and exit 0.
//
// Exit codes:
//   0  recording finalized successfully
//   1  user cancelled the picker (no output written)
//   2  a fatal error occurred
//
// Requires macOS 14+ (SCContentSharingPicker) and the Screen Recording
// permission (macOS prompts on first run).

import AVFoundation
import AppKit
import CoreMedia
import ScreenCaptureKit

@available(macOS 14.0, *)
final class Recorder: NSObject, SCStreamOutput, SCStreamDelegate, SCContentSharingPickerObserver {
    private let outputURL: URL
    private var stream: SCStream?
    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private var sessionStarted = false
    private var finished = false
    private let frameQueue = DispatchQueue(label: "windowrec.frames")
    private let sampleQueue = DispatchQueue(label: "windowrec.samples")

    init(outputURL: URL) {
        self.outputURL = outputURL
    }

    func start() {
        let picker = SCContentSharingPicker.shared
        picker.add(self)
        var config = SCContentSharingPickerConfiguration()
        config.allowedPickerModes = [.singleWindow]
        picker.configuration = config
        picker.isActive = true
        picker.present()
    }

    // MARK: - SCContentSharingPickerObserver

    func contentSharingPicker(_ picker: SCContentSharingPicker,
                              didUpdateWith filter: SCContentFilter,
                              for stream: SCStream?) {
        picker.isActive = false
        picker.remove(self)
        beginRecording(with: filter)
    }

    func contentSharingPicker(_ picker: SCContentSharingPicker,
                              didCancelFor stream: SCStream?) {
        // User dismissed the picker without choosing a window.
        exitCleanly(1)
    }

    func contentSharingPickerStartDidFailWithError(_ error: Error) {
        FileHandle.standardError.write("picker failed: \(error)\n".data(using: .utf8)!)
        exitCleanly(2)
    }

    // MARK: - Recording

    private func beginRecording(with filter: SCContentFilter) {
        let scale = filter.pointPixelScale
        let rect = filter.contentRect
        // Round to even dimensions — H.264 requires even width/height.
        var width = Int((rect.width * CGFloat(scale)).rounded())
        var height = Int((rect.height * CGFloat(scale)).rounded())
        width -= width % 2
        height -= height % 2
        if width <= 0 || height <= 0 { width = 1280; height = 720 }

        let config = SCStreamConfiguration()
        config.width = width
        config.height = height
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
        config.queueDepth = 6
        config.showsCursor = true

        do {
            try setupWriter(width: width, height: height)
        } catch {
            FileHandle.standardError.write("writer setup failed: \(error)\n".data(using: .utf8)!)
            exitCleanly(2)
            return
        }

        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        do {
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)
        } catch {
            FileHandle.standardError.write("addStreamOutput failed: \(error)\n".data(using: .utf8)!)
            exitCleanly(2)
            return
        }
        self.stream = stream

        stream.startCapture { [weak self] error in
            if let error = error {
                FileHandle.standardError.write("startCapture failed: \(error)\n".data(using: .utf8)!)
                self?.exitCleanly(2)
                return
            }
            // Signal readiness so the parent process knows recording is live.
            FileHandle.standardOutput.write("RECORDING_STARTED\n".data(using: .utf8)!)
        }
    }

    private func setupWriter(width: Int, height: Int) throws {
        try? FileManager.default.removeItem(at: outputURL)
        let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            // Cap the bitrate so short clips stay small enough for the upload
            // path. ~2.5 Mbps is plenty for typical UI/screen content.
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 2_500_000,
                AVVideoMaxKeyFrameIntervalKey: 60,
            ],
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        if writer.canAdd(input) { writer.add(input) }
        self.writer = writer
        self.input = input
    }

    // MARK: - SCStreamOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid else { return }
        // Only append frames that are marked complete.
        guard let attachmentsArray = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let attachments = attachmentsArray.first,
              let statusRaw = attachments[.status] as? Int,
              let status = SCFrameStatus(rawValue: statusRaw),
              status == .complete else { return }

        frameQueue.sync {
            guard let writer = writer, let input = input, !finished else { return }
            let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            if !sessionStarted {
                writer.startWriting()
                writer.startSession(atSourceTime: pts)
                sessionStarted = true
            }
            if input.isReadyForMoreMediaData {
                input.append(sampleBuffer)
            }
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        FileHandle.standardError.write("stream stopped: \(error)\n".data(using: .utf8)!)
        finalize(exitCode: 2)
    }

    // MARK: - Teardown

    func stop() {
        finalize(exitCode: 0)
    }

    private func finalize(exitCode: Int32) {
        frameQueue.sync {
            if finished { return }
            finished = true
        }
        let done = { [weak self] in
            guard let self = self else { exit(exitCode) }
            self.writer?.finishWriting {
                exit(exitCode)
            }
        }
        if let stream = stream {
            stream.stopCapture { _ in done() }
        } else {
            done()
        }
    }

    private func exitCleanly(_ code: Int32) {
        // No stream/writer to flush — used for picker cancel/errors.
        exit(code)
    }
}

// MARK: - Entry point

guard #available(macOS 14.0, *) else {
    FileHandle.standardError.write("windowrec requires macOS 14 or later\n".data(using: .utf8)!)
    exit(2)
}

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write("usage: windowrec <output.mp4>\n".data(using: .utf8)!)
    exit(2)
}

let outputURL = URL(fileURLWithPath: args[1])
let recorder = Recorder(outputURL: outputURL)

// Finalize the MP4 on SIGINT/SIGTERM (sent by the parent process to stop).
var signalSources: [DispatchSourceSignal] = []
let signalQueue = DispatchQueue(label: "windowrec.signals")
for sig in [SIGINT, SIGTERM] {
    signal(sig, SIG_IGN)
    let source = DispatchSource.makeSignalSource(signal: sig, queue: signalQueue)
    source.setEventHandler { recorder.stop() }
    source.resume()
    // Keep the source alive for the process lifetime.
    signalSources.append(source)
}

// ScreenCaptureKit's picker needs a running app + main run loop.
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
DispatchQueue.main.async {
    recorder.start()
}
app.run()
