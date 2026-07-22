const fs = require('fs');
const files = fs.readdirSync('./src/routes').filter(f => f.endsWith('.js'));
for (const file of files) {
  try {
    require('./src/routes/' + file);
    console.log('✅ ' + file);
  } catch (e) {
    console.error('❌ ' + file + ':', e.message);
  }
}
