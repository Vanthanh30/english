export interface GrammarFeedbackItem {
  error: string;
  correction: string;
  explanation: string;
}

export interface NewVocabularyItem {
  word: string;
  partOfSpeech: string;
  vietnameseMeaning: string;
  exampleSentence: string;
  alreadySaved?: boolean;
}

export interface GrammarPatternItem {
  pattern: string;
  explanation: string;
  example: string;
}

export interface ImageWritingSession {
  id: string;
  userId: string;
  imageUrl: string;
  imagePublicId: string | null;
  userText: string;
  revisedText: string | null;
  overallScore: number;
  accuracyFeedback: string;
  grammarFeedback: GrammarFeedbackItem[];
  improvedParagraph: string;
  newVocabulary: NewVocabularyItem[];
  grammarPatterns: GrammarPatternItem[];
  revisedScore: number | null;
  createdAt: string;
  updatedAt: string;
}
