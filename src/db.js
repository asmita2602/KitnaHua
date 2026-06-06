import Dexie from 'dexie'

export const db = new Dexie('KitnaHua')

db.version(2).stores({
  days: 'date, dayType',
  tasks: '++id, date, title, tag, priority, points, completed, feedbackDone, dayTypeTemplate',
  feedback: 'date',
  rewards: '++id, name, cost',
  redemptions: '++id, date, rewardId, name, cost',
  aiAnalysis: 'date, score, rating, analysis, recommendation, reclassifiedType',
  subjects: '++id, name, description',
  topics: '++id, subjectId, name, totalLectures',
  lectures: '++id, topicId, subjectId, name, watched, notesMade, questionsSolved, revisionDone, lastStudied',
})

db.on('populate', () => {
  db.rewards.bulkAdd([
    { name: 'Ice Cream 🍦', cost: 300 },
    { name: 'Movie Night 🎬', cost: 1000 },
  ])
})