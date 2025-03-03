const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');

const DU_BULLETIN_URL = 'https://bulletin.du.edu/undergraduate/majorsminorscoursedescriptions/traditionalbachelorsprogrammajorandminors/computerscience/#coursedescriptionstext'; 

async function scrapeBulletin() {
    try {
        // Fetch the webpage HTML
        const { data } = await axios.get(DU_BULLETIN_URL);
        console.log("✅ Successfully fetched the webpage!");

        const $ = cheerio.load(data);
        const courses = [];

        // Debugging: Print first 500 characters of page content
        console.log("🔍 Page HTML Preview:", data.substring(0, 500));

        // Loop through each course block
        $('.courseblock').each((i, elem) => {
            let titleElement = $(elem).find('.courseblocktitle').text().trim();
            let descriptionElement = $(elem).find('.courseblockdesc').text().trim();

            if (titleElement) {
                console.log(`🔹 Found Course Title: ${titleElement}`);

                // Match "COMP XXXX Course Title (X Credits)"
                const match = titleElement.match(/(COMP\s?\d{4})\s(.+?)\s+\(\d+\sCredits\)/);

                if (match) {
                    let courseCode = match[1].replace('&nbsp;', ' ').trim(); // e.g., "COMP 3621"
                    let courseTitle = match[2].trim(); // e.g., "Computer Networking"

                    let courseNumber = parseInt(courseCode.match(/\d{4}/)[0]); // Extract numeric part

                    // **Improved Prerequisite Filtering**
                    let hasPrerequisite = /Prerequisite|Requires|Pre-requisite|must complete before/i.test(descriptionElement);

                    if (courseNumber >= 3000 && !hasPrerequisite) {
                        courses.push({ course: courseCode, title: courseTitle });
                        console.log(`✅ Added: ${courseCode} - ${courseTitle}`);
                    } else {
                        console.log(`⚠️ Skipping ${courseCode} - Prerequisite detected or below 3000 level`);
                    }
                } else {
                    console.log("⚠️ Course title format did not match expected pattern.");
                }
            }
        });

        // **Handle Empty Results**
        if (courses.length === 0) {
            console.log("❌ No courses found that meet the criteria!");
        } else {
            console.log(`✅ Extracted ${courses.length} valid courses.`);
        }

        // **Ensure results directory exists**
        await fs.ensureDir('results');

        // **Save the extracted data into bulletin.json**
        const outputFile = 'results/bulletin.json';
        await fs.writeJSON(outputFile, { courses }, { spaces: 2 });

        console.log(`📁 Bulletin data successfully saved in ${outputFile}`);
    } catch (error) {
        console.error('❌ Error while scraping DU Bulletin:', error);
    }
}

// Run the scraper
scrapeBulletin();
