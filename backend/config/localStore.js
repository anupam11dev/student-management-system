const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'sms_data.json');

// In-memory cache synced with disk
let dbCache = {
  users: [],
  students: [],
  courses: [],
  attendance: [],
  marks: []
};

// Ensure data directory and file exist
const initStore = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      dbCache = JSON.parse(content);
      // Ensure defaults for students and users
      if (dbCache.students) {
        dbCache.students.forEach(s => {
          if (!s.status) s.status = 'active';
        });
      }
      if (dbCache.users) {
        dbCache.users.forEach(u => {
          if (!u.status) u.status = 'active';
        });
      }
    } catch (e) {
      console.error('[LocalStore] Error reading cache file, starting with empty store:', e.message);
    }
  } else {
    saveToDisk();
  }
};

const saveToDisk = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[LocalStore] Error saving store to disk:', err.message);
  }
};

const matchFilter = (item, filter = {}) => {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, val] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(val)) {
      const anyMatch = val.some(subFilter => matchFilter(item, subFilter));
      if (!anyMatch) return false;
      continue;
    }

    const itemVal = item[key];

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      // Regex
      if (val.$regex) {
        const regex = new RegExp(val.$regex, val.$options || '');
        if (!regex.test(String(itemVal || ''))) return false;
        continue;
      }
      // $in
      if (Array.isArray(val.$in)) {
        if (!val.$in.map(String).includes(String(itemVal))) return false;
        continue;
      }
      // $gte
      if (val.$gte !== undefined) {
        if (itemVal < val.$gte) return false;
      }
      // $lte
      if (val.$lte !== undefined) {
        if (itemVal > val.$lte) return false;
      }
      // $ne
      if (val.$ne !== undefined) {
        if (String(itemVal) === String(val.$ne)) return false;
      }
      continue;
    }

    if (String(itemVal) !== String(val)) {
      return false;
    }
  }
  return true;
};

class QueryCursor {
  constructor(collectionName, items) {
    this.collectionName = collectionName;
    this.items = items.map(i => ({ ...i }));
    this._sortField = null;
    this._sortOrder = 1;
    this._skip = 0;
    this._limit = null;
    this._populates = [];
  }

  sort(sortObj) {
    if (sortObj && typeof sortObj === 'object') {
      const [field, order] = Object.entries(sortObj)[0] || ['createdAt', -1];
      this._sortField = field;
      this._sortOrder = order === 'asc' || order === 1 ? 1 : -1;
    }
    return this;
  }

  skip(n) {
    this._skip = Math.max(0, parseInt(n) || 0);
    return this;
  }

  limit(n) {
    this._limit = Math.max(0, parseInt(n) || 0);
    return this;
  }

  populate(field, select) {
    this._populates.push({ field, select });
    return this;
  }

  async exec() {
    let result = [...this.items];

    if (this._sortField) {
      result.sort((a, b) => {
        const aVal = a[this._sortField];
        const bVal = b[this._sortField];
        if (aVal < bVal) return -1 * this._sortOrder;
        if (aVal > bVal) return 1 * this._sortOrder;
        return 0;
      });
    }

    if (this._skip > 0) {
      result = result.slice(this._skip);
    }

    if (this._limit !== null && this._limit > 0) {
      result = result.slice(0, this._limit);
    }

    // Apply population
    for (const pop of this._populates) {
      const targetCol = getRefCollection(pop.field);
      if (targetCol && dbCache[targetCol]) {
        for (const doc of result) {
          const refId = doc[pop.field];
          if (refId) {
            const found = dbCache[targetCol].find(x => String(x._id) === String(refId._id || refId));
            if (found) {
              doc[pop.field] = { ...found };
            }
          }
        }
      }
    }

    return result;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

const getRefCollection = (fieldName) => {
  switch (fieldName) {
    case 'studentId':
    case 'linkedStudentId':
      return 'students';
    case 'courseId':
      return 'courses';
    case 'teacherId':
    case 'markedBy':
    case 'enteredBy':
      return 'users';
    default:
      return null;
  }
};

class SingleDocumentCursor {
  constructor(collectionName, item) {
    this.collectionName = collectionName;
    this.item = item ? { ...item } : null;
    this._populates = [];
  }

  populate(field, select) {
    this._populates.push({ field, select });
    return this;
  }

  async exec() {
    if (!this.item) return null;
    const doc = { ...this.item };
    for (const pop of this._populates) {
      const targetCol = getRefCollection(pop.field);
      if (targetCol && dbCache[targetCol]) {
        const refId = doc[pop.field];
        if (refId) {
          const found = dbCache[targetCol].find(x => String(x._id) === String(refId._id || refId));
          if (found) {
            doc[pop.field] = { ...found };
          }
        }
      }
    }
    return doc;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

class LocalCollection {
  constructor(name) {
    this.name = name;
  }

  get items() {
    if (!dbCache[this.name]) {
      dbCache[this.name] = [];
    }
    return dbCache[this.name];
  }

  find(filter = {}) {
    const matched = this.items.filter(item => matchFilter(item, filter));
    return new QueryCursor(this.name, matched);
  }

  findOne(filter = {}) {
    const item = this.items.find(i => matchFilter(i, filter));
    return new SingleDocumentCursor(this.name, item || null);
  }

  findById(id) {
    const item = this.items.find(i => String(i._id) === String(id));
    return new SingleDocumentCursor(this.name, item || null);
  }

  async create(data) {
    if (Array.isArray(data)) {
      const createdList = [];
      for (const d of data) {
        const item = {
          _id: d._id ? String(d._id) : new mongoose.Types.ObjectId().toString(),
          ...(this.name === 'students' || this.name === 'users' ? { status: 'active' } : {}),
          ...d,
          createdAt: d.createdAt || new Date().toISOString()
        };
        this.items.push(item);
        createdList.push({ ...item });
      }
      saveToDisk();
      return createdList;
    } else {
      const item = {
        _id: data._id ? String(data._id) : new mongoose.Types.ObjectId().toString(),
        ...(this.name === 'students' || this.name === 'users' ? { status: 'active' } : {}),
        ...data,
        createdAt: data.createdAt || new Date().toISOString()
      };
      this.items.push(item);
      saveToDisk();
      return { ...item };
    }
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const index = this.items.findIndex(i => String(i._id) === String(id));
    if (index === -1) return null;

    const current = this.items[index];
    const updated = {
      ...current,
      ...(update.$set || update),
      _id: current._id,
      updatedAt: new Date().toISOString()
    };
    this.items[index] = updated;
    saveToDisk();
    return { ...updated };
  }

  async findByIdAndDelete(id) {
    const index = this.items.findIndex(i => String(i._id) === String(id));
    if (index === -1) return null;
    const [removed] = this.items.splice(index, 1);
    saveToDisk();
    return removed;
  }

  async deleteOne(filter) {
    const index = this.items.findIndex(i => matchFilter(i, filter));
    if (index === -1) return { deletedCount: 0 };
    this.items.splice(index, 1);
    saveToDisk();
    return { deletedCount: 1 };
  }

  async deleteMany(filter) {
    const initialLen = this.items.length;
    const remaining = this.items.filter(i => !matchFilter(i, filter));
    dbCache[this.name] = remaining;
    saveToDisk();
    return { deletedCount: initialLen - remaining.length };
  }

  async countDocuments(filter = {}) {
    return this.items.filter(i => matchFilter(i, filter)).length;
  }

  async updateOne(filter, update, options = {}) {
    const index = this.items.findIndex(i => matchFilter(i, filter));
    if (index === -1) {
      if (options.upsert) {
        const item = {
          _id: new mongoose.Types.ObjectId().toString(),
          ...filter,
          ...(update.$set || update),
          createdAt: new Date().toISOString()
        };
        this.items.push(item);
        saveToDisk();
        return { matchedCount: 0, modifiedCount: 1, upsertedId: item._id };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }
    const current = this.items[index];
    this.items[index] = {
      ...current,
      ...(update.$set || update),
      _id: current._id,
      updatedAt: new Date().toISOString()
    };
    saveToDisk();
    return { matchedCount: 1, modifiedCount: 1 };
  }
}

initStore();

module.exports = {
  LocalCollection,
  dbCache,
  saveToDisk,
  initStore
};
