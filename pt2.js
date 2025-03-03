const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Helper: Extract a balanced JSON object from a string, starting at a given index.
function extractJSONObject(str, startIndex) {
  let stack = [];
  let inString = false;
  let stringChar = null;
  let escape = false;
  
  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === stringChar) {
        inString = false;
      }
    } else {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
      } else if (char === '{') {
        stack.push('{');
      } else if (char === '}') {
        stack.pop();
        if (stack.length === 0) {
          return str.substring(startIndex, i + 1);
        }
      }
    }
  }
  return null;
}

const url = 'https://denverpioneers.com/'; // adjust URL if needed

axios.get(url)
  .then(response => {
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Instead of selecting the first script with "var obj =", filter for one that includes '"type":"events"'
    let scriptContent;
    $('script').each((i, el) => {
      const content = $(el).html();
      if (content && content.includes('var obj =') && content.includes('"type":"events"')) {
        scriptContent = content;
        return false; // break out once found
      }
    });
    
    if (!scriptContent) {
      throw new Error('Script containing event data not found.');
    }
    
    // Find the position of "var obj =" and then the first "{" after it.
    const varObjIndex = scriptContent.indexOf("var obj =");
    if (varObjIndex === -1) {
      throw new Error('Could not find "var obj =" in the script.');
    }
    
    const jsonStart = scriptContent.indexOf("{", varObjIndex);
    if (jsonStart === -1) {
      throw new Error('Could not find the beginning of the JSON object.');
    }
    
    // Extract the balanced JSON portion.
    const jsonStr = extractJSONObject(scriptContent, jsonStart);
    if (!jsonStr) {
      throw new Error('Failed to extract a balanced JSON object.');
    }
    
    // (Optional) Log a snippet for debugging.
    console.log("Extracted JSON snippet:", jsonStr.substring(0, 500));
    
    let dataObj;
    try {
      dataObj = JSON.parse(jsonStr);
    } catch (error) {
      console.error("Extracted JSON (first 1000 chars):", jsonStr.substring(0, 1000));
      throw new Error('Failed to parse JSON: ' + error.message);
    }
    
    // Extract events from the "data" property.
    const events = dataObj.data.map(event => {
      const eventDate = event.date || "";
      const opponent = event.opponent && event.opponent.name ? event.opponent.name : "";
      let duTeam = "";
      if (event.result && event.result.line_scores) {
        const ls = event.result.line_scores;
        if (ls.home_full_name && ls.home_full_name.toLowerCase().includes('denver')) {
          duTeam = ls.home_full_name;
        } else if (ls.away_full_name && ls.away_full_name.toLowerCase().includes('denver')) {
          duTeam = ls.away_full_name;
        }
      }
      if (!duTeam) {
        duTeam = "University of Denver";
      }
      return { duTeam, opponent, date: eventDate };
    });
    
    const finalResults = { events };
    
    // Ensure the results directory exists.
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }
    
    // Write the output file.
    const filePath = path.join(resultsDir, 'athletic_events.json');
    fs.writeFileSync(filePath, JSON.stringify(finalResults, null, 2));
    console.log(`Events have been saved to ${filePath}`);
  })
  .catch(err => {
    console.error('Error:', err.message);
  });