import Dexie from 'dexie'
import dexieCloud from 'dexie-cloud-addon'

export const db = new Dexie('KitnaHua', { addons: [dexieCloud] })

db.version(3).stores({
  days: '@date, dayType',
  tasks: '@id, date, title, tag, priority, points, completed, feedbackDone, dayTypeTemplate',
  feedback: '@date',
  rewards: '@id, name, cost',
  redemptions: '@id, date, rewardId, name, cost',
  aiAnalysis: '@date, score, rating, analysis, recommendation, reclassifiedType',
  subjects: '@id, name, description',
  topics: '@id, subjectId, name, totalLectures',
  lectures: '@id, topicId, subjectId, name, watched, notesMade, questionsSolved, revisionDone, lastStudied',
})

db.cloud.configure({
  databaseUrl: 'https://ztzyryvif.dexie.cloud',
  requireAuth: false,
  tryUseServiceWorker: false,
})

db.on('populate', () => {
  db.rewards.bulkAdd([
    { name: 'Ice Cream 🍦', cost: 300 },
    { name: 'Movie Night 🎬', cost: 1000 },
  ])
})