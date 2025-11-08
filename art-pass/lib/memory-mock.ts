export type PassportItem = {
  id: string;
  title: string;
  imageUrl: string;
  visitDate: string; // YYYY-MM-DD
  time?: string; // HH:MM 可選，給右下角 LCD
};

export const passportItems: PassportItem[] = [
  {
    id: "m1",
    title: "夜間博物館：北美館 x 電音共演",
    imageUrl:
      "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?q=80&w=1600&auto=format&fit=crop",
    visitDate: "2025-11-10",
    time: "21:00",
  },
  {
    id: "m2",
    title: "島嶼記憶—原民樂舞的現在式",
    imageUrl:
      "https://images.unsplash.com/photo-1761839257658-23502c67f6d5?q=80&w=1600&auto=format&fit=crop",
    visitDate: "2025-11-03",
    time: "14:00",
  },
  {
    id: "m3",
    title: "城市幻彩—沉浸式光影特展",
    imageUrl:
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=1600&auto=format&fit=crop",
    visitDate: "2025-10-28",
    time: "19:30",
  },
  {
    id: "m4",
    title: "聽覺微旅：爵士散步",
    imageUrl:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=1600&auto=format&fit=crop",
    visitDate: "2025-10-21",
    time: "19:00",
  },
];

