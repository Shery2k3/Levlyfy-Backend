const BaseRepository = require("./BaseRepo.js");
const db = require("../../models/index.js");

class PerformanceRepo extends BaseRepository {
    constructor() {
        super(db.Performance);
        this.model = db.Performance;
    }

    async createPerformance(performance) {
        return this.create(performance);
    }

    async getPerformances(searchQuery = {}) {
        return this.findAll(searchQuery);
    }

    async findById(id) {
        return this.findOne({ id });
    }

    async deletePerformance(id, type = "soft") {
        return this.delete(id, type);
    }

    async countPerformances(query = {}) {
        return this.count(query);
    }

    async findPerformanceWithInclude(customQuery) {
        return this.findOneWithInclude(customQuery);
    }

    async updatePerformance(performance, id) {
        await this.update(performance, { id });
        return this.findOne(id);
    }

    async isPerformanceExists(id) {
        return this.count(id);
    }
}

module.exports = new PerformanceRepo();