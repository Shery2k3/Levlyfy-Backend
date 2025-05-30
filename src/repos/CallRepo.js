const BaseRepository = require("./BaseRepo.js");
const db = require("../../models/index.js");

class CallRepo extends BaseRepository {
  constructor() {
    super(db.Call);
    this.model = db.Call;
  }

  async createCall(call) {
    return this.create(call);
  }

  async getCalls(searchQuery = {}) {
    return this.findAll(searchQuery);
  }

  async findById(id) {
    return this.findOne({ id });
  }

  async deleteCall(id, type = "soft") {
    return this.delete(id, type);
  }

  async countCalls(query = {}) {
    return this.count(query);
  }

  async findCallWithInclude(customQuery) {
    return this.findOneWithInclude(customQuery);
  }

  async updateCall(call, id) {
    await this.update(call, { id });
    return this.findOne(id);
  }

  async isCallExists(id) {
    return this.count(id);
  }
}

module.exports = new CallRepo();
