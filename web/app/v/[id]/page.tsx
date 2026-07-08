import { getRecordingUrl } from "@/lib/blob";
import ShareBar from "@/components/ShareBar";

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const videoUrl = getRecordingUrl(id);

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-900">
      <ShareBar shareUrl={`/v/${id}`} />
      <div className="flex flex-1 items-center justify-center p-4">
        <video
          controls
          autoPlay
          playsInline
          src={videoUrl}
          className="max-h-full max-w-full rounded shadow-lg"
        />
      </div>
    </main>
  );
}
