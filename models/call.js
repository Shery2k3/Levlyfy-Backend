"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Call extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Call.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
    }
  }
  Call.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      callDate: {
        type: DataTypes.DATE,
      },
      audioUrl: {
        type: DataTypes.STRING,
      },
      transcript: {
        type: DataTypes.TEXT,
      },
      sentiment: {
        type: DataTypes.STRING,
      },
      callType: {
        type: DataTypes.STRING,
      },
      callFeedback: {
        type: DataTypes.TEXT,
      },
      callNotes: {
        type: DataTypes.TEXT,
      },
      callSummary: {
        type: DataTypes.TEXT,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: "pending",
      },
      ivKey: {
        type: DataTypes.TEXT,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "Call",
      timestamps: true,
    }
  );
  return Call;
};
