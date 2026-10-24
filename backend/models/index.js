const mongoose = require('mongoose');
const { LocalCollection } = require('../config/localStore');

const UserModel = require('./User');
const StudentModel = require('./Student');
const CourseModel = require('./Course');
const AttendanceModel = require('./Attendance');
const MarksModel = require('./Marks');

const localCollections = {
  User: new LocalCollection('users'),
  Student: new LocalCollection('students'),
  Course: new LocalCollection('courses'),
  Attendance: new LocalCollection('attendance'),
  Marks: new LocalCollection('marks')
};

const createModelProxy = (modelName, MongooseModel) => {
  return new Proxy({}, {
    get(target, prop) {
      const isMongoReady = mongoose.connection.readyState === 1;
      const activeModel = isMongoReady ? MongooseModel : localCollections[modelName];

      const value = activeModel[prop];
      if (typeof value === 'function') {
        return value.bind(activeModel);
      }
      return value;
    }
  });
};

module.exports = {
  User: createModelProxy('User', UserModel),
  Student: createModelProxy('Student', StudentModel),
  Course: createModelProxy('Course', CourseModel),
  Attendance: createModelProxy('Attendance', AttendanceModel),
  Marks: createModelProxy('Marks', MarksModel),
  // Direct mongoose references if needed
  rawModels: {
    User: UserModel,
    Student: StudentModel,
    Course: CourseModel,
    Attendance: AttendanceModel,
    Marks: MarksModel
  }
};

