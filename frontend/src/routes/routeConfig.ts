export const routes = {
  home: "/",
  auth: {
    login: "/login",
    register: "/register",
    forgotPassword: "/forgot-password",
    verifyEmail: "/verify-email",
  },
  client: {
    dashboard: "/dashboard",
    courses: "/courses",
    lessons: "/lessons",
    flashcards: "/flashcards",
    writingPractice: "/flashcards/practice",
    notes: "/notes",
    chatbot: "/chatbot",
    vocabulary: "/vocabulary",
    imageVocabulary: "/image-vocabulary",
    schedule: "/schedule",
    profile: "/profile",
  },
  admin: {
    dashboard: "/admin",
    content: "/admin/content",
    users: "/admin/users",
    reports: "/admin/reports",
    settings: "/admin/settings",
  },
} as const;
