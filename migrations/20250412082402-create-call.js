'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Calls', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      callDate: {
        type: Sequelize.DATE
      },
      audioUrl: {
        type: Sequelize.STRING
      },
      transcript: {
        type: Sequelize.TEXT
      },
      sentiment: {
        type: Sequelize.STRING
      },
      callType: {
        type: Sequelize.STRING
      },
      callFeedback: {
        type: Sequelize.TEXT
      },
      callNotes: {
        type: Sequelize.TEXT
      },
      callSummary: {
        type: Sequelize.TEXT
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'pending'
      },
      ivKey: {
        type: Sequelize.TEXT
      },
      isDeleted:{
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Calls');
  }
};