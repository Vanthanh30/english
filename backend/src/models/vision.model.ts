export interface VisionWordModel {
  id: string;
  historyId: string;
  word: string;
  meaning: string;
  meaningVi: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  saved: boolean;
  x: number | null;
  y: number | null;
}

export interface VisionHistoryModel {
  id: string;
  userId: string;
  imageUrl: string;
  imagePublicId: string | null;
  createdAt: Date;
  words?: VisionWordModel[];
}
