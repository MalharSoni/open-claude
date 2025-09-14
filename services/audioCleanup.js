const fs = require('fs');
const path = require('path');

class AudioCleanupService {
  constructor() {
    this.audioDir = path.join(__dirname, '..', 'public', 'audio');
    this.maxFiles = 100; // Maximum number of files to keep
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  async cleanupOldFiles() {
    try {
      if (!fs.existsSync(this.audioDir)) {
        return { cleaned: 0, message: 'Audio directory does not exist' };
      }

      const files = fs.readdirSync(this.audioDir)
        .filter(file => file.endsWith('.mp3'))
        .map(file => {
          const filepath = path.join(this.audioDir, file);
          const stats = fs.statSync(filepath);
          return {
            name: file,
            path: filepath,
            created: stats.birthtime.getTime(),
            size: stats.size
          };
        })
        .sort((a, b) => b.created - a.created); // Sort by newest first

      let cleanedCount = 0;
      const now = Date.now();

      // Remove files older than maxAge
      const expiredFiles = files.filter(file => (now - file.created) > this.maxAge);
      for (const file of expiredFiles) {
        fs.unlinkSync(file.path);
        cleanedCount++;
        console.log(`Cleaned expired audio file: ${file.name}`);
      }

      // Remove excess files if we still have too many
      const remainingFiles = files.filter(file => (now - file.created) <= this.maxAge);
      if (remainingFiles.length > this.maxFiles) {
        const excessFiles = remainingFiles.slice(this.maxFiles);
        for (const file of excessFiles) {
          fs.unlinkSync(file.path);
          cleanedCount++;
          console.log(`Cleaned excess audio file: ${file.name}`);
        }
      }

      return {
        cleaned: cleanedCount,
        remaining: remainingFiles.length - Math.max(0, remainingFiles.length - this.maxFiles),
        message: `Cleaned ${cleanedCount} files`
      };

    } catch (error) {
      console.error('Error during audio cleanup:', error);
      return {
        error: error.message,
        cleaned: 0
      };
    }
  }

  async getStorageInfo() {
    try {
      if (!fs.existsSync(this.audioDir)) {
        return {
          fileCount: 0,
          totalSize: 0,
          oldestFile: null,
          newestFile: null
        };
      }

      const files = fs.readdirSync(this.audioDir)
        .filter(file => file.endsWith('.mp3'))
        .map(file => {
          const filepath = path.join(this.audioDir, file);
          const stats = fs.statSync(filepath);
          return {
            name: file,
            created: stats.birthtime.getTime(),
            size: stats.size
          };
        });

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const sortedFiles = files.sort((a, b) => a.created - b.created);

      return {
        fileCount: files.length,
        totalSize: totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        oldestFile: sortedFiles.length > 0 ? {
          name: sortedFiles[0].name,
          age: Date.now() - sortedFiles[0].created,
          ageHours: Math.round((Date.now() - sortedFiles[0].created) / (1000 * 60 * 60))
        } : null,
        newestFile: sortedFiles.length > 0 ? {
          name: sortedFiles[sortedFiles.length - 1].name,
          age: Date.now() - sortedFiles[sortedFiles.length - 1].created,
          ageMinutes: Math.round((Date.now() - sortedFiles[sortedFiles.length - 1].created) / (1000 * 60))
        } : null
      };

    } catch (error) {
      console.error('Error getting storage info:', error);
      return { error: error.message };
    }
  }

  // Schedule automatic cleanup
  startAutoCleanup(intervalHours = 6) {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    setInterval(async () => {
      console.log('Running automatic audio cleanup...');
      const result = await this.cleanupOldFiles();
      console.log('Auto cleanup result:', result);
    }, intervalMs);

    console.log(`Audio cleanup scheduled every ${intervalHours} hours`);
  }
}

module.exports = new AudioCleanupService();