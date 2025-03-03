const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');

const BASE_URL = 'https://www.du.edu/calendar';
const RESULTS_FILE = 'results/calendar_events.json';

// Define months with date ranges
const months = [
    { start: "2025-01-01", end: "2025-02-01" },
    { start: "2025-02-01", end: "2025-03-01" },
    { start: "2025-03-01", end: "2025-04-01" },
    { start: "2025-04-01", end: "2025-05-01" },
    { start: "2025-05-01", end: "2025-06-01" },
    { start: "2025-06-01", end: "2025-07-01" },
    { start: "2025-07-01", end: "2025-08-01" },
    { start: "2025-08-01", end: "2025-09-01" },
    { start: "2025-09-01", end: "2025-10-01" },
    { start: "2025-10-01", end: "2025-11-01" },
    { start: "2025-11-01", end: "2025-12-01" },
    { start: "2025-12-01", end: "2026-01-01" }
];

// Fetch event details from event page
async function fetchEventDetails(eventUrl) {
    try {
        const { data } = await axios.get(eventUrl);
        const $ = cheerio.load(data);

        let description = $('.description').text().trim() || "N/A";
        let time = $('p:has(.icon-du-clock)').text().trim().replace(/.*icon-du-clock\s*/, '') || "N/A";

        return { description, time };
    } catch (error) {
        console.error(`Error fetching details for ${eventUrl}:`, error);
        return { description: "N/A", time: "N/A" };
    }
}

// Scrape all events from a given month
async function scrapeEventsFromMonth(startDate, endDate) {
    let allEvents = [];
    let currentPage = `${BASE_URL}?search=&start_date=${startDate}&end_date=${endDate}#events-listing-date-filter-anchor`;

    console.log(`Scraping events from ${startDate} to ${endDate}...`);

    while (currentPage) {
        let eventsOnPage = await scrapeEventsFromPage(currentPage);

        for (let event of eventsOnPage) {
            let details = await fetchEventDetails(event.eventUrl);
            allEvents.push({
                title: event.title,
                date: event.date,
                time: details.time,
                description: details.description
            });
        }

        // Check if there's a "Next" button for pagination
        const { data } = await axios.get(currentPage);
        const $ = cheerio.load(data);
        let nextPage = $('.pagination-next a').attr('href');

        currentPage = nextPage ? `https://www.du.edu${nextPage}` : null;
    }

    return allEvents;
}

// Scrape all events from a single page
async function scrapeEventsFromPage(url) {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        let events = [];

        $('#events-listing .events-listing__item').each((_, element) => {
            let title = $(element).find('h3').text().trim();
            let date = $(element).find('p').first().text().trim();
            let eventUrl = $(element).find('a.event-card').attr('href');

            if (eventUrl) {
                eventUrl = eventUrl.startsWith('http') ? eventUrl : `https://www.du.edu${eventUrl}`;
                events.push({ title, date, eventUrl });
            }
        });

        return events;
    } catch (error) {
        console.error(`Error scraping events from ${url}:`, error);
        return [];
    }
}

// Scrape all events for all months
async function scrapeAllEvents() {
    let allEvents = [];

    for (const { start, end } of months) {
        const events = await scrapeEventsFromMonth(start, end);
        allEvents = allEvents.concat(events);
    }

    // Sort events by date
    allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Save results
    fs.writeJsonSync(RESULTS_FILE, { events: allEvents }, { spaces: 2 });
    console.log(`✅ Scraping complete. Events saved to ${RESULTS_FILE}`);
}

// Start scraping
scrapeAllEvents();
