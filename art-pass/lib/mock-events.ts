import type { EventSummary } from "./types";

const baseImage =
  "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?q=80&w=1200&auto=format&fit=crop";

export const featuredEvents: EventSummary[] = [
  {
    eventId: "evt-01",
    title: "城市幻彩—沉浸式光影特展",
    category: "視覺藝術",
    startDate: "2025/11/28",
    startTime: "19:30",
    venue: "台北流行音樂中心",
    imageUrl: `${baseImage}&sat=20`,
    ticketType: "售票",
    ticketPrices: [
      { label: "一般", value: "750" },
      { label: "學生", value: "550" },
    ],
    favorite: true,
  },
  {
    eventId: "evt-02",
    title: "島嶼記憶—原民樂舞的現在式",
    category: "表演藝術",
    startDate: "2025/12/03",
    startTime: "14:00",
    venue: "國家戲劇院實驗劇場",
    imageUrl: `${baseImage}&sat=60`,
    ticketType: "售票",
    ticketPrices: [{ label: "一般", value: "450" }],
  },
  {
    eventId: "evt-03",
    title: "夜間博物館：北美館 x 電音共演",
    category: "跨界合作",
    startDate: "2025/12/10",
    startTime: "21:00",
    venue: "北美館中庭",
    imageUrl: `${baseImage}&sat=0`,
    ticketType: "報名",
    ticketPrices: [{ label: "名額", value: "限額 80 人" }],
  },
];

export const upcomingEvents: EventSummary[] = [
  {
    eventId: "evt-11",
    title: "聽覺微旅：爵士散步",
    category: "音樂現場",
    startDate: "2025/11/09",
    startTime: "19:00",
    venue: "誠品表演廳",
    imageUrl: `${baseImage}&sat=-20`,
    ticketType: "售票",
    ticketPrices: [
      { label: "預售", value: "550" },
      { label: "現場", value: "650" },
    ],
  },
  {
    eventId: "evt-12",
    title: "無界劇場：AR 互動劇《回聲》",
    category: "沉浸式劇場",
    startDate: "2025/11/15",
    startTime: "15:30",
    venue: "華山 1914 文創園區",
    imageUrl: `${baseImage}&sat=30`,
    ticketType: "售票",
    ticketPrices: [{ label: "套票", value: "980" }],
  },
  {
    eventId: "evt-13",
    title: "綠色島嶼影展—環境與未來",
    category: "影展",
    startDate: "2025/11/18",
    startTime: "13:00",
    venue: "光點台北電影院",
    imageUrl: `${baseImage}&sat=80`,
    ticketType: "售票",
    ticketPrices: [{ label: "單日", value: "350" }],
  },
  {
    eventId: "evt-14",
    title: "午后藝想：親子創作工作坊",
    category: "親子教育",
    startDate: "2025/11/23",
    startTime: "10:30",
    venue: "松菸文創實驗室",
    imageUrl: `${baseImage}&sat=-60`,
    ticketType: "報名",
    ticketPrices: [{ label: "家庭組", value: "1,200" }],
  },
];

