import LessonLearningPage from "@/components/lesson/LessonLearningPage";

export default async function LessonRoute({
  params,
}: Readonly<{
  params: Promise<{ lessonId: string }>;
}>) {
  const { lessonId } = await params;
  return <LessonLearningPage lessonId={lessonId} />;
}
