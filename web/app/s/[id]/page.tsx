import { getScreenshotUrl, getSource } from "@/lib/blob";
import AnnotationCanvas from "@/components/AnnotationCanvas";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const imageUrl = getScreenshotUrl(id);
  const sourceUrl = await getSource(id);

  return (
    <main className="h-screen w-screen overflow-hidden bg-neutral-900">
      <AnnotationCanvas
        imageUrl={imageUrl}
        shareUrl={`/s/${id}`}
        sourceUrl={sourceUrl}
      />
    </main>
  );
}
