import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../../.env'), override: true });

const prisma = new PrismaClient();

const TEST_PASSWORDS = {
  admin: 'Admin123!',
  student: 'Student123!',
  pending: 'Pending123!',
  suspended: 'Suspended123!',
} as const;

const PENDING_VERIFICATION_TOKEN =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

interface SeedVocabulary {
  word: string;
  meaning: string;
  meaningVi: string;
  pronunciation: string;
  partOfSpeech: string;
  exampleSentence: string;
}

async function upsertUser(input: {
  email: string;
  displayName: string;
  password: string;
  role: 'ADMIN' | 'STUDENT';
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED';
}) {
  const passwordHash = await hash(input.password, 12);
  const data = {
    email: input.email,
    displayName: input.displayName,
    passwordHash,
    role: input.role,
    status: input.status,
    emailVerifiedAt: input.status === 'ACTIVE' ? new Date() : null,
  };
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return prisma.user.update({
      where: { email: input.email },
      data,
    });
  }
  return prisma.user.create({
    data,
  });
}

async function upsertVocabulary(topicId: string, input: SeedVocabulary) {
  const existing = await prisma.vocabulary.findUnique({
    where: {
      topicId_word: {
        topicId,
        word: input.word,
      },
    },
  });
  if (existing) {
    return prisma.vocabulary.update({
      where: {
        id: existing.id,
      },
      data: input,
    });
  }
  return prisma.vocabulary.create({
    data: {
      topicId,
      ...input,
    },
  });
}

async function upsertLesson(input: {
  topicId: string;
  title: string;
  slug: string;
  description: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  status: 'DRAFT' | 'PUBLISHED';
  vocabularyIds: string[];
}) {
  const data = {
    topicId: input.topicId,
    title: input.title,
    slug: input.slug,
    description: input.description,
    level: input.level,
    status: input.status,
    publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
  };
  const existing = await prisma.lesson.findUnique({ where: { slug: input.slug } });
  let lesson;
  if (existing) {
    lesson = await prisma.lesson.update({
      where: { slug: input.slug },
      data,
    });
  } else {
    lesson = await prisma.lesson.create({
      data,
    });
  }

  await prisma.lessonItem.deleteMany({ where: { lessonId: lesson.id } });
  if (input.vocabularyIds.length) {
    for (const [order, vocabularyId] of input.vocabularyIds.entries()) {
      await prisma.lessonItem.create({
        data: {
          lessonId: lesson.id,
          vocabularyId,
          order,
        },
      });
    }
  }

  return lesson;
}

async function seedUsers() {
  const admin = await upsertUser({
    email: 'admin@englishquest.local',
    displayName: 'English Quest Admin',
    password: TEST_PASSWORDS.admin,
    role: 'ADMIN',
    status: 'ACTIVE',
  });
  const student = await upsertUser({
    email: 'student@englishquest.local',
    displayName: 'Demo Student',
    password: TEST_PASSWORDS.student,
    role: 'STUDENT',
    status: 'ACTIVE',
  });
  const pending = await upsertUser({
    email: 'pending@englishquest.local',
    displayName: 'Pending Student',
    password: TEST_PASSWORDS.pending,
    role: 'STUDENT',
    status: 'PENDING_VERIFICATION',
  });
  const suspended = await upsertUser({
    email: 'suspended@englishquest.local',
    displayName: 'Suspended Student',
    password: TEST_PASSWORDS.suspended,
    role: 'STUDENT',
    status: 'SUSPENDED',
  });

  await prisma.refreshToken.deleteMany({
    where: { userId: { in: [admin.id, student.id, pending.id, suspended.id] } },
  });
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: pending.id },
  });
  await prisma.emailVerificationToken.create({
    data: {
      userId: pending.id,
      tokenHash: createHash('sha256')
        .update(PENDING_VERIFICATION_TOKEN)
        .digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      consumedAt: null,
    },
  });

  return { admin, student, pending, suspended };
}

async function seedContent() {
  // 1. TOPIC: Travel Essentials
  const travel = await prisma.topic.upsert({
    where: { slug: 'travel-essentials' },
    create: {
      name: 'Travel Essentials',
      slug: 'travel-essentials',
      description: 'Useful English for airports, hotels, and journeys.',
      level: 'BEGINNER',
      order: 1,
      isActive: true,
    },
    update: {
      name: 'Travel Essentials',
      description: 'Useful English for airports, hotels, and journeys.',
      level: 'BEGINNER',
      order: 1,
      isActive: true,
    },
  });

  // 2. TOPIC: Food and Dining
  const food = await prisma.topic.upsert({
    where: { slug: 'food-and-dining' },
    create: {
      name: 'Food and Dining',
      slug: 'food-and-dining',
      description: 'Order food, describe flavors, and talk to restaurant staff.',
      level: 'BEGINNER',
      order: 2,
      isActive: true,
    },
    update: {
      name: 'Food and Dining',
      description: 'Order food, describe flavors, and talk to restaurant staff.',
      level: 'BEGINNER',
      order: 2,
      isActive: true,
    },
  });

  // 3. TOPIC: Workplace Communication
  const workplace = await prisma.topic.upsert({
    where: { slug: 'workplace-communication' },
    create: {
      name: 'Workplace Communication',
      slug: 'workplace-communication',
      description: 'Communicate clearly in meetings and daily office work.',
      level: 'INTERMEDIATE',
      order: 3,
      isActive: true,
    },
    update: {
      name: 'Workplace Communication',
      description: 'Communicate clearly in meetings and daily office work.',
      level: 'INTERMEDIATE',
      order: 3,
      isActive: true,
    },
  });

  // 4. TOPIC: Academic English
  const academic = await prisma.topic.upsert({
    where: { slug: 'academic-english' },
    create: {
      name: 'Academic English',
      slug: 'academic-english',
      description: 'Advanced vocabulary for research, formal writing, and critical analysis.',
      level: 'ADVANCED',
      order: 4,
      isActive: true,
    },
    update: {
      name: 'Academic English',
      description: 'Advanced vocabulary for research, formal writing, and critical analysis.',
      level: 'ADVANCED',
      order: 4,
      isActive: true,
    },
  });

  // 5. TOPIC: Technology & Social Media
  const technology = await prisma.topic.upsert({
    where: { slug: 'tech-and-social-media' },
    create: {
      name: 'Technology & Social Media',
      slug: 'tech-and-social-media',
      description: 'Talk about software development, online privacy, and internet trends.',
      level: 'INTERMEDIATE',
      order: 5,
      isActive: true,
    },
    update: {
      name: 'Technology & Social Media',
      description: 'Talk about software development, online privacy, and internet trends.',
      level: 'INTERMEDIATE',
      order: 5,
      isActive: true,
    },
  });

  // Seed Vocabularies
  const travelWords = await Promise.all([
    upsertVocabulary(travel.id, {
      word: 'passport',
      meaning: 'an official document used for international travel',
      meaningVi: 'hộ chiếu',
      pronunciation: '/ˈpɑːspɔːrt/',
      partOfSpeech: 'noun',
      exampleSentence: 'Please show your passport at the check-in desk.',
    }),
    upsertVocabulary(travel.id, {
      word: 'departure',
      meaning: 'the act or time of leaving a place',
      meaningVi: 'sự khởi hành; thời điểm rời đi',
      pronunciation: '/dɪˈpɑːrtʃər/',
      partOfSpeech: 'noun',
      exampleSentence: 'Our departure time is displayed on the board.',
    }),
    upsertVocabulary(travel.id, {
      word: 'luggage',
      meaning: 'bags and cases used while traveling',
      meaningVi: 'hành lý',
      pronunciation: '/ˈlʌɡɪdʒ/',
      partOfSpeech: 'noun',
      exampleSentence: 'Your luggage must weigh less than twenty kilograms.',
    }),
    upsertVocabulary(travel.id, {
      word: 'boarding pass',
      meaning: 'a document that allows a passenger to enter an aircraft',
      meaningVi: 'thẻ lên máy bay',
      pronunciation: '/ˈbɔːrdɪŋ pæs/',
      partOfSpeech: 'noun',
      exampleSentence: 'Keep your boarding pass ready at the gate.',
    }),
    upsertVocabulary(travel.id, {
      word: 'destination',
      meaning: 'the place to which someone is traveling',
      meaningVi: 'điểm đến',
      pronunciation: '/ˌdestɪˈneɪʃn/',
      partOfSpeech: 'noun',
      exampleSentence: 'Paris is our final destination.',
    }),
    upsertVocabulary(travel.id, {
      word: 'delay',
      meaning: 'a period of time when you must wait for something to happen',
      meaningVi: 'sự trì hoãn, làm trễ',
      pronunciation: '/dɪˈleɪ/',
      partOfSpeech: 'noun',
      exampleSentence: 'The flight was cancelled after a long delay.',
    }),
    upsertVocabulary(travel.id, {
      word: 'itinerary',
      meaning: 'a detailed plan or route of a journey',
      meaningVi: 'lộ trình, lịch trình chuyến đi',
      pronunciation: '/aɪˈtɪnəreri/',
      partOfSpeech: 'noun',
      exampleSentence: 'We must prepare a detailed travel itinerary.',
    }),
    upsertVocabulary(travel.id, {
      word: 'accommodation',
      meaning: 'a place to live, work, or stay in',
      meaningVi: 'chỗ ở, nơi lưu trú',
      pronunciation: '/əˌkɑːməˈdeɪʃn/',
      partOfSpeech: 'noun',
      exampleSentence: 'Hotel accommodation is included in the tour price.',
    }),
    upsertVocabulary(travel.id, {
      word: 'sightseeing',
      meaning: 'the activity of visiting interesting places, especially by tourists',
      meaningVi: 'ngắm cảnh, tham quan',
      pronunciation: '/ˈsaɪtsiːɪŋ/',
      partOfSpeech: 'noun',
      exampleSentence: 'We did some sightseeing in Paris this morning.',
    }),
    upsertVocabulary(travel.id, {
      word: 'souvenir',
      meaning: 'something you buy or keep to help you remember a holiday',
      meaningVi: 'quà lưu niệm',
      pronunciation: '/ˌsuːvəˈnɪr/',
      partOfSpeech: 'noun',
      exampleSentence: 'I bought a miniature Eiffel Tower as a souvenir.',
    }),
  ]);

  const foodWords = await Promise.all([
    upsertVocabulary(food.id, {
      word: 'recommend',
      meaning: 'to suggest something as a good choice',
      meaningVi: 'đề xuất; giới thiệu',
      pronunciation: '/ˌrekəˈmend/',
      partOfSpeech: 'verb',
      exampleSentence: 'Could you recommend a vegetarian dish?',
    }),
    upsertVocabulary(food.id, {
      word: 'ingredient',
      meaning: 'one of the foods used to make a dish',
      meaningVi: 'nguyên liệu',
      pronunciation: '/ɪnˈɡriːdiənt/',
      partOfSpeech: 'noun',
      exampleSentence: 'Fresh basil is the main ingredient in this sauce.',
    }),
    upsertVocabulary(food.id, {
      word: 'spicy',
      meaning: 'having a strong, hot flavor',
      meaningVi: 'cay',
      pronunciation: '/ˈspaɪsi/',
      partOfSpeech: 'adjective',
      exampleSentence: 'Is this curry very spicy?',
    }),
    upsertVocabulary(food.id, {
      word: 'bill',
      meaning: 'a statement showing how much must be paid',
      meaningVi: 'hóa đơn',
      pronunciation: '/bɪl/',
      partOfSpeech: 'noun',
      exampleSentence: 'Could we have the bill, please?',
    }),
    upsertVocabulary(food.id, {
      word: 'delicious',
      meaning: 'having a very pleasant taste or smell',
      meaningVi: 'ngon miệng, thơm ngon',
      pronunciation: '/dɪˈlɪʃəs/',
      partOfSpeech: 'adjective',
      exampleSentence: 'This soup is absolutely delicious.',
    }),
    upsertVocabulary(food.id, {
      word: 'cuisine',
      meaning: 'a style of cooking, especially of a particular country',
      meaningVi: 'ẩm thực',
      pronunciation: '/kwaɪˈziːn/',
      partOfSpeech: 'noun',
      exampleSentence: 'I love traditional Vietnamese cuisine.',
    }),
    upsertVocabulary(food.id, {
      word: 'reservation',
      meaning: 'an arrangement to have something kept for you (e.g. table)',
      meaningVi: 'sự đặt bàn trước',
      pronunciation: '/ˌrezərˈveɪʃn/',
      partOfSpeech: 'noun',
      exampleSentence: 'I made a reservation for two at 8 PM.',
    }),
    upsertVocabulary(food.id, {
      word: 'buffet',
      meaning: 'a meal where people serve themselves from a table of foods',
      meaningVi: 'tiệc buffet',
      pronunciation: '/bəˈfeɪ/',
      partOfSpeech: 'noun',
      exampleSentence: 'The hotel provides a complimentary breakfast buffet.',
    }),
    upsertVocabulary(food.id, {
      word: 'appetizer',
      meaning: 'a small dish of food served before the main meal',
      meaningVi: 'món khai vị',
      pronunciation: '/ˈæpɪtaɪzər/',
      partOfSpeech: 'noun',
      exampleSentence: 'We ordered spring rolls as an appetizer.',
    }),
    upsertVocabulary(food.id, {
      word: 'recipe',
      meaning: 'a set of instructions for cooking a particular dish',
      meaningVi: 'công thức nấu ăn',
      pronunciation: '/ˈresəpi/',
      partOfSpeech: 'noun',
      exampleSentence: 'She gave me a great recipe for chocolate cake.',
    }),
  ]);

  const workplaceWords = await Promise.all([
    upsertVocabulary(workplace.id, {
      word: 'deadline',
      meaning: 'the latest time by which work must be completed',
      meaningVi: 'hạn chót',
      pronunciation: '/ˈdedlaɪn/',
      partOfSpeech: 'noun',
      exampleSentence: 'The project deadline is Friday afternoon.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'agenda',
      meaning: 'a list of topics to discuss at a meeting',
      meaningVi: 'chương trình nghị sự',
      pronunciation: '/əˈdʒendə/',
      partOfSpeech: 'noun',
      exampleSentence: 'The budget is the first item on the agenda.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'collaboration',
      meaning: 'the act of working with another person or group',
      meaningVi: 'sự hợp tác',
      pronunciation: '/kəˌlæbəˈreɪʃn/',
      partOfSpeech: 'noun',
      exampleSentence: 'The project was a successful collaboration.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'feedback',
      meaning: 'information or statements of opinion about something',
      meaningVi: 'phản hồi, nhận xét',
      pronunciation: '/ˈfiːdbæk/',
      partOfSpeech: 'noun',
      exampleSentence: 'We welcome your feedback on the new software.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'negotiate',
      meaning: 'to try to reach an agreement by formal discussion',
      meaningVi: 'đàm phán, thương lượng',
      pronunciation: '/nɪˈɡəʊʃieɪt/',
      partOfSpeech: 'verb',
      exampleSentence: 'We need to negotiate a better deal with our suppliers.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'presentation',
      meaning: 'a talk giving information about something to a group',
      meaningVi: 'bài thuyết trình',
      pronunciation: '/ˌpriːzenˈteɪʃn/',
      partOfSpeech: 'noun',
      exampleSentence: 'His presentation on marketing strategy was clear.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'productivity',
      meaning: 'the rate at which a worker or company produces goods',
      meaningVi: 'năng suất, hiệu suất làm việc',
      pronunciation: '/ˌproʊdʌkˈtɪvəti/',
      partOfSpeech: 'noun',
      exampleSentence: 'Working from home can increase productivity.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'colleague',
      meaning: 'a person that you work with',
      meaningVi: 'đồng nghiệp',
      pronunciation: '/ˈkɑːliːɡ/',
      partOfSpeech: 'noun',
      exampleSentence: 'I discussed the issue with a colleague.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'delegate',
      meaning: 'to give a particular job or duty to someone else',
      meaningVi: 'giao phó, ủy quyền',
      pronunciation: '/ˈdelɪɡeɪt/',
      partOfSpeech: 'verb',
      exampleSentence: 'A good manager knows how to delegate tasks.',
    }),
    upsertVocabulary(workplace.id, {
      word: 'brainstorm',
      meaning: 'to suggest a lot of ideas for a future activity',
      meaningVi: 'động não, thảo luận tìm ý tưởng',
      pronunciation: '/ˈbreɪnstɔːrm/',
      partOfSpeech: 'verb',
      exampleSentence: 'We need to brainstorm some new marketing ideas.',
    }),
  ]);

  const academicWords = await Promise.all([
    upsertVocabulary(academic.id, {
      word: 'analyze',
      meaning: 'to study something in detail to discover more about it',
      meaningVi: 'phân tích',
      pronunciation: '/ˈænəlaɪz/',
      partOfSpeech: 'verb',
      exampleSentence: 'We need to analyze the test results before publishing.',
    }),
    upsertVocabulary(academic.id, {
      word: 'hypothesis',
      meaning: 'an idea or explanation that is not yet proven',
      meaningVi: 'giả thuyết',
      pronunciation: '/haɪˈpɒθəsɪs/',
      partOfSpeech: 'noun',
      exampleSentence: 'Our research proves that the initial hypothesis was correct.',
    }),
    upsertVocabulary(academic.id, {
      word: 'methodology',
      meaning: 'a system of methods used in a particular area of study',
      meaningVi: 'phương pháp luận',
      pronunciation: '/ˌmeθəˈdɒlədʒi/',
      partOfSpeech: 'noun',
      exampleSentence: 'We chose a qualitative research methodology.',
    }),
    upsertVocabulary(academic.id, {
      word: 'significant',
      meaning: 'important or noticeable',
      meaningVi: 'quan trọng, đáng kể',
      pronunciation: '/sɪɡˈnɪfɪkənt/',
      partOfSpeech: 'adjective',
      exampleSentence: 'There is a significant difference between the two samples.',
    }),
    upsertVocabulary(academic.id, {
      word: 'evidence',
      meaning: 'one or more facts that show something is true',
      meaningVi: 'bằng chứng',
      pronunciation: '/ˈevɪdəns/',
      partOfSpeech: 'noun',
      exampleSentence: 'There is no scientific evidence to support this claim.',
    }),
    upsertVocabulary(academic.id, {
      word: 'evaluate',
      meaning: 'to judge or calculate the quality, importance, or value of something',
      meaningVi: 'đánh giá',
      pronunciation: '/ɪˈvæljueɪt/',
      partOfSpeech: 'verb',
      exampleSentence: 'We must evaluate the project outcomes carefully.',
    }),
    upsertVocabulary(academic.id, {
      word: 'literature',
      meaning: 'written works, especially those considered of superior or lasting artistic merit',
      meaningVi: 'tài liệu học thuật, văn chương',
      pronunciation: '/ˈlɪtrətʃʊr/',
      partOfSpeech: 'noun',
      exampleSentence: 'He conducted a comprehensive literature review.',
    }),
    upsertVocabulary(academic.id, {
      word: 'synthesis',
      meaning: 'the combination of components or elements to form a connected whole',
      meaningVi: 'sự tổng hợp',
      pronunciation: '/ˈsɪnθəsɪs/',
      partOfSpeech: 'noun',
      exampleSentence: 'The paper presents a synthesis of current research.',
    }),
    upsertVocabulary(academic.id, {
      word: 'empirical',
      meaning: 'based on, concerned with, or verifiable by observation or experience',
      meaningVi: 'mang tính thực nghiệm',
      pronunciation: '/ɪmˈpɪrɪkl/',
      partOfSpeech: 'adjective',
      exampleSentence: 'We gathered empirical data during our field studies.',
    }),
    upsertVocabulary(academic.id, {
      word: 'paradigm',
      meaning: 'a typical example or pattern of something; a model',
      meaningVi: 'hệ hình, mô thức',
      pronunciation: '/ˈpærədaɪm/',
      partOfSpeech: 'noun',
      exampleSentence: 'This research marks a paradigm shift in psychology.',
    }),
  ]);

  const techWords = await Promise.all([
    upsertVocabulary(technology.id, {
      word: 'algorithm',
      meaning: 'a set of rules or steps to be followed in calculations or problem-solving',
      meaningVi: 'thuật toán',
      pronunciation: '/ˈælɡərɪðəm/',
      partOfSpeech: 'noun',
      exampleSentence: 'The search engine uses a complex algorithm.',
    }),
    upsertVocabulary(technology.id, {
      word: 'encryption',
      meaning: 'the process of converting information or data into a code to prevent unauthorized access',
      meaningVi: 'sự mã hóa',
      pronunciation: '/ɪnˈkrɪpʃn/',
      partOfSpeech: 'noun',
      exampleSentence: 'Data encryption is essential for secure communication.',
    }),
    upsertVocabulary(technology.id, {
      word: 'interface',
      meaning: 'a point where two systems, subjects, organizations, etc., meet and interact',
      meaningVi: 'giao diện',
      pronunciation: '/ˈɪntərfeɪs/',
      partOfSpeech: 'noun',
      exampleSentence: 'The user interface of this application is very clean.',
    }),
    upsertVocabulary(technology.id, {
      word: 'database',
      meaning: 'a structured set of data held in a computer, especially one that is accessible in various ways',
      meaningVi: 'cơ sở dữ liệu',
      pronunciation: '/ˈdeɪtəbeɪs/',
      partOfSpeech: 'noun',
      exampleSentence: 'Our user records are stored in a secure database.',
    }),
    upsertVocabulary(technology.id, {
      word: 'connectivity',
      meaning: 'the state or extent of being connected or interconnected',
      meaningVi: 'khả năng kết nối',
      pronunciation: '/ˌkɑːnekˈtɪvəti/',
      partOfSpeech: 'noun',
      exampleSentence: 'This device offers excellent wireless connectivity.',
    }),
    upsertVocabulary(technology.id, {
      word: 'innovation',
      meaning: 'the action or process of innovating; a new method, idea, product, etc.',
      meaningVi: 'sự đổi mới, sáng kiến',
      pronunciation: '/ˌɪnəˈveɪʃn/',
      partOfSpeech: 'noun',
      exampleSentence: 'Technological innovation drives economic growth.',
    }),
    upsertVocabulary(technology.id, {
      word: 'privacy',
      meaning: 'the state or condition of being free from public attention or intrusion',
      meaningVi: 'sự riêng tư',
      pronunciation: '/ˈpraɪvəsi/',
      partOfSpeech: 'noun',
      exampleSentence: 'Internet privacy is a major concern today.',
    }),
    upsertVocabulary(technology.id, {
      word: 'interact',
      meaning: 'act in such a way as to have an effect on another; communicate',
      meaningVi: 'tương tác',
      pronunciation: '/ˌɪntərˈækt/',
      partOfSpeech: 'verb',
      exampleSentence: 'Users can interact with each other in real time.',
    }),
    upsertVocabulary(technology.id, {
      word: 'notification',
      meaning: 'a message that appears on a screen to inform the user of an event',
      meaningVi: 'thông báo',
      pronunciation: '/ˌnoʊtɪfɪˈkeɪʃn/',
      partOfSpeech: 'noun',
      exampleSentence: 'I received a notification on my phone.',
    }),
    upsertVocabulary(technology.id, {
      word: 'virtual',
      meaning: 'almost or nearly as described, but not completely or according to strict definition',
      meaningVi: 'ảo, thực tế ảo',
      pronunciation: '/ˈvɜːrtʃuəl/',
      partOfSpeech: 'adjective',
      exampleSentence: 'They organized a virtual meeting for remote employees.',
    }),
  ]);

  // Seed Lessons (2-3 lessons per Topic)
  // Travel Lessons
  const lAirport = await upsertLesson({
    topicId: travel.id,
    title: 'At the Airport',
    slug: 'at-the-airport',
    description: 'Learn the words needed from check-in to boarding.',
    level: 'BEGINNER',
    status: 'PUBLISHED',
    vocabularyIds: travelWords.slice(0, 4).map((w) => w.id),
  });

  const lJourney = await upsertLesson({
    topicId: travel.id,
    title: 'Planning a Journey',
    slug: 'planning-a-journey',
    description: 'Talk about departures and destinations.',
    level: 'BEGINNER',
    status: 'PUBLISHED',
    vocabularyIds: [travelWords[1].id, travelWords[4].id, travelWords[2].id, travelWords[5].id, travelWords[6].id, travelWords[7].id],
  });

  const lExploring = await upsertLesson({
    topicId: travel.id,
    title: 'Exploring the City',
    slug: 'exploring-the-city',
    description: 'Useful words for sightseeing and souvenirs.',
    level: 'BEGINNER',
    status: 'DRAFT',
    vocabularyIds: [travelWords[8].id, travelWords[9].id],
  });

  // Food Lessons
  const lRestaurant = await upsertLesson({
    topicId: food.id,
    title: 'At a Restaurant',
    slug: 'at-a-restaurant',
    description: 'Order confidently and understand common menu language.',
    level: 'BEGINNER',
    status: 'PUBLISHED',
    vocabularyIds: foodWords.slice(0, 5).map((w) => w.id),
  });

  const lCooking = await upsertLesson({
    topicId: food.id,
    title: 'Cooking & Recipes',
    slug: 'cooking-and-recipes',
    description: 'Learn how to describe meals, ingredients, and dishes.',
    level: 'BEGINNER',
    status: 'PUBLISHED',
    vocabularyIds: foodWords.slice(5, 10).map((w) => w.id),
  });

  // Workplace Lessons
  const lMeeting = await upsertLesson({
    topicId: workplace.id,
    title: 'Running a Meeting',
    slug: 'running-a-meeting',
    description: 'Learn how to present agendas, collaborate, and gather feedback.',
    level: 'INTERMEDIATE',
    status: 'PUBLISHED',
    vocabularyIds: [workplaceWords[1].id, workplaceWords[2].id, workplaceWords[3].id, workplaceWords[5].id, workplaceWords[9].id],
  });

  const lTaskMgmt = await upsertLesson({
    topicId: workplace.id,
    title: 'Task Management',
    slug: 'task-management',
    description: 'Talk about project deadlines, delegation, and productivity.',
    level: 'INTERMEDIATE',
    status: 'DRAFT',
    vocabularyIds: [workplaceWords[0].id, workplaceWords[4].id, workplaceWords[6].id, workplaceWords[7].id, workplaceWords[8].id],
  });

  // Academic Lessons
  const lResearch = await upsertLesson({
    topicId: academic.id,
    title: 'Academic Research',
    slug: 'academic-research',
    description: 'Read and talk about scientific studies, hypotheses, and methodology.',
    level: 'ADVANCED',
    status: 'PUBLISHED',
    vocabularyIds: academicWords.slice(0, 5).map((w) => w.id),
  });

  const lCriticalAnalysis = await upsertLesson({
    topicId: academic.id,
    title: 'Critical Analysis',
    slug: 'critical-analysis',
    description: 'Learn how to evaluate scientific papers and synthesis of literature.',
    level: 'ADVANCED',
    status: 'DRAFT',
    vocabularyIds: academicWords.slice(5, 10).map((w) => w.id),
  });

  // Tech Lessons
  const lSoftwareDev = await upsertLesson({
    topicId: technology.id,
    title: 'Software Development',
    slug: 'software-development',
    description: 'Discuss search algorithms, database structures, and UI layout.',
    level: 'INTERMEDIATE',
    status: 'PUBLISHED',
    vocabularyIds: techWords.slice(0, 5).map((w) => w.id),
  });

  const lDigitalLife = await upsertLesson({
    topicId: technology.id,
    title: 'Digital Life',
    slug: 'digital-life',
    description: 'Learn vocabulary related to online privacy, innovations, and social interactions.',
    level: 'INTERMEDIATE',
    status: 'PUBLISHED',
    vocabularyIds: techWords.slice(5, 10).map((w) => w.id),
  });

  return {
    travelWords,
    foodWords,
    workplaceWords,
    academicWords,
    techWords,
    lessons: {
      lAirport,
      lJourney,
      lExploring,
      lRestaurant,
      lCooking,
      lMeeting,
      lTaskMgmt,
      lResearch,
      lCriticalAnalysis,
      lSoftwareDev,
      lDigitalLife,
    },
  };
}

async function seedProgress(
  studentId: string,
  content: Awaited<ReturnType<typeof seedContent>>,
) {
  await prisma.vocabularyProgress.deleteMany({ where: { userId: studentId } });
  await prisma.lessonProgress.deleteMany({ where: { userId: studentId } });

  const now = new Date();
  const completedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

  // 1. Student has completed "At a Restaurant" (all 5 words completed)
  const restaurantWords = content.foodWords.slice(0, 5);
  for (const word of restaurantWords) {
    await prisma.vocabularyProgress.create({
      data: {
        userId: studentId,
        lessonId: content.lessons.lRestaurant.id,
        vocabularyId: word.id,
        completedAt,
        createdAt: completedAt,
      },
    });
  }
  await prisma.lessonProgress.create({
    data: {
      userId: studentId,
      lessonId: content.lessons.lRestaurant.id,
      completedAt,
      createdAt: completedAt,
    },
  });

  // 2. Student has completed "At the Airport" (all 4 words completed)
  const airportWords = content.travelWords.slice(0, 4);
  for (const word of airportWords) {
    await prisma.vocabularyProgress.create({
      data: {
        userId: studentId,
        lessonId: content.lessons.lAirport.id,
        vocabularyId: word.id,
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });
  }
  await prisma.lessonProgress.create({
    data: {
      userId: studentId,
      lessonId: content.lessons.lAirport.id,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // 3. Student has partially completed "Running a Meeting" (3 of 5 words completed)
  const meetingWords = [content.workplaceWords[1], content.workplaceWords[2], content.workplaceWords[3]];
  for (const word of meetingWords) {
    await prisma.vocabularyProgress.create({
      data: {
        userId: studentId,
        lessonId: content.lessons.lMeeting.id,
        vocabularyId: word.id,
        completedAt: now,
        createdAt: now,
      },
    });
  }
  // (No LessonProgress record since it's not fully completed)
}

async function seedNotesAndFlashcards(
  studentId: string,
  content: Awaited<ReturnType<typeof seedContent>>,
) {
  // Clear notes and flashcards
  await prisma.note.deleteMany({ where: { ownerId: studentId } });
  await prisma.flashcard.deleteMany({ where: { userId: studentId } });

  const now = new Date();

  // Create Notes
  const notesData = [
    {
      title: 'Useful Airport Vocabulary',
      contentHtml: '<h2>Vocabulary to check-in</h2><ul><li>Make sure you have your <strong>passport</strong>.</li><li>Check the <strong>departure</strong> board.</li><li>Ensure your <strong>luggage</strong> is weighed.</li></ul>',
      searchText: 'Useful Airport Vocabulary Vocabulary to check-in Make sure you have your passport Check the departure board Ensure your luggage is weighed',
    },
    {
      title: 'Restaurant Order Notes',
      contentHtml: '<h2>Key phrases</h2><p>Could you <em>recommend</em> a good appetizer?</p><p>We would like to pay the <em>bill</em>.</p>',
      searchText: 'Restaurant Order Notes Key phrases Could you recommend a good appetizer We would like to pay the bill',
    },
    {
      title: 'Workplace Meeting Phrases',
      contentHtml: '<h2>Meetings</h2><p>Set a clear <strong>agenda</strong> before the meeting.</p><p>Ask for <strong>feedback</strong> from your colleagues.</p>',
      searchText: 'Workplace Meeting Phrases Meetings Set a clear agenda before the meeting Ask for feedback from your colleagues',
    },
  ];

  const notes = [];
  for (const note of notesData) {
    const createdNote = await prisma.note.create({
      data: {
        ownerId: studentId,
        ...note,
      },
    });
    notes.push(createdNote);
  }

  // Save/Link vocabulary words to notes
  await prisma.savedVocabularyNote.create({
    data: {
      ownerId: studentId,
      vocabularyId: content.travelWords[0].id, // passport
      noteId: notes[0].id,
      lessonId: content.lessons.lAirport.id,
    },
  });

  await prisma.savedVocabularyNote.create({
    data: {
      ownerId: studentId,
      vocabularyId: content.foodWords[0].id, // recommend
      noteId: notes[1].id,
      lessonId: content.lessons.lRestaurant.id,
    },
  });

  // Create Flashcards for student (some due, some in future)
  const flashcardWords = [
    { id: content.travelWords[0].id, nextReview: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }, // passport - due
    { id: content.travelWords[1].id, nextReview: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) }, // departure - not due
    { id: content.travelWords[2].id, nextReview: new Date(Date.now() - 5 * 60 * 60 * 1000) },      // luggage - due
    { id: content.foodWords[0].id, nextReview: new Date(Date.now() - 10 * 60 * 60 * 1000) },      // recommend - due
    { id: content.foodWords[2].id, nextReview: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) }, // spicy - not due
    { id: content.workplaceWords[1].id, nextReview: new Date(Date.now() - 1 * 60 * 60 * 1000) },   // agenda - due
  ];

  for (const item of flashcardWords) {
    await prisma.flashcard.create({
      data: {
        userId: studentId,
        vocabularyId: item.id,
        nextReviewAt: item.nextReview,
        lastReviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

async function main() {
  const users = await seedUsers();
  const content = await seedContent();
  await seedProgress(users.student.id, content);
  await seedNotesAndFlashcards(users.student.id, content);

  console.log('English Quest rich test data is ready.');
  console.table([
    {
      role: 'ADMIN',
      email: users.admin.email,
      password: TEST_PASSWORDS.admin,
      state: 'active',
    },
    {
      role: 'STUDENT',
      email: users.student.email,
      password: TEST_PASSWORDS.student,
      state: 'active with rich progress (2 lessons complete, 1 in progress)',
    },
    {
      role: 'STUDENT',
      email: users.pending.email,
      password: TEST_PASSWORDS.pending,
      state: 'pending verification',
    },
    {
      role: 'STUDENT',
      email: users.suspended.email,
      password: TEST_PASSWORDS.suspended,
      state: 'suspended account',
    },
  ]);
  console.log(`Pending verification token: ${PENDING_VERIFICATION_TOKEN}`);
  console.log(
    'Content successfully seeded: 5 topics, 50 vocabularies, 11 lessons (7 published, 4 drafts), progress logs, 3 study notes, and 6 active flashcards.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
