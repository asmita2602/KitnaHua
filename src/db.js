import Dexie from 'dexie'

export const db = new Dexie('KitnaHua')

db.version(3).stores({
  days: 'date, dayType',
  tasks: '++id, date, title, tag, priority, points, completed, feedbackDone, dayTypeTemplate, subjectId, subjectName, topicId, topicName, fromTemplateId',
  feedback: 'date',
  rewards: '++id, name, cost',
  redemptions: '++id, date, rewardId, name, cost',
  aiAnalysis: 'date, score, rating, analysis, recommendation, reclassifiedType',
  subjects: '++id, name, description',
  topics: '++id, subjectId, name, totalLectures',
  lectures: '++id, topicId, subjectId, name, watched, notesMade, questionsSolved, revisionDone, lastStudied',
  completions: '++id, date, templateTaskId',
})