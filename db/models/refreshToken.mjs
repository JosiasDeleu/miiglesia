import { sequelize } from '../sequelize.js';
import { DataTypes, Op } from 'sequelize';

const RefreshToken = sequelize.define('refresh_tokens', {
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'token'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'refresh_tokens',
  underscored: true,
  indexes: [
    { fields: ['token'] },
    { fields: ['user_id'] }
  ]
});

// Clean up expired tokens periodically
async function cleanupExpiredTokens() {
  await RefreshToken.destroy({
    where: {
      expiresAt: { [Op.lt]: new Date() }
    }
  });
}

export { RefreshToken, cleanupExpiredTokens };
