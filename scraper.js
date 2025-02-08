const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  // Launch Chrome in headless mode
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Capture browser console output
  page.on("console", (msg) => console.log(`[Browser Console] ${msg.text()}`));

  // Navigate to the page
  await page.goto(
    "https://makeawishca.donordrive.com/index.cfm?fuseaction=donorDrive.search&filter=team&eventID=1364",
    { waitUntil: "networkidle2" } // Ensure page is fully loaded
  );

  // ✅ Capture the returned CSV data
  const results = await page.evaluate(async () => {
    console.log("Hello from the browser console!");

    const eventId = 1364;
    const currentUnixTime = () => Date.now();

    function arrayToCSV(data) {
      if (data.length === 0) return ""; // Handle empty data case

      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(",")];

      data.forEach((row) => {
        const values = headers.map((header) =>
          JSON.stringify(row[header] || "")
        );
        csvRows.push(values.join(","));
      });

      return csvRows.join("\n");
    }

    async function fetchTeamMembers(cleanedTeams) {
      let cleanedTeamMembers = [];

      for (const team of cleanedTeams) {
        console.log(`Getting team members for ${team.name}`);

        const url = `https://makeawishca.donordrive.com/api/1.3/teams/${
          team.id
        }/participants?limit=10&offset=0&orderBy=sumDonations%20DESC%2C%20displayName%20ASC&_=${currentUnixTime()}`;

        try {
          const teamMembersResponse = await fetch(url);
          const teamMembersData = await teamMembersResponse.json();

          teamMembersData.forEach((member) => {
            cleanedTeamMembers.push({
              teamName: member.teamName,
              memberName: member.displayName,
              donations: member.sumDonations,
            });
          });
        } catch (error) {
          console.error(`Failed to fetch team members for ${team.name}:`, error);
        }
      }

      return cleanedTeamMembers;
    }

    async function downloadToCsv() {
      const url = `https://makeawishca.donordrive.com/api/1.1/events/${eventId}/teams?where=%28captainDisplayName+LIKE+%27%25desjardins%25%27+OR+name+LIKE+%27%25desjardins%25%27%29&orderBy=name+ASC&limit=100&_=${currentUnixTime()}`;
      const teamsResponse = await fetch(url);
      const teamsData = await teamsResponse.json();

      const cleanedTeams = teamsData.map((team) => ({
        name: team.name,
        donations: team.sumDonations,
        id: team.teamID,
      }));

      const cleanedTeamMembers = await fetchTeamMembers(cleanedTeams);

      console.log("Finished fetching and processing team members.");
      console.log("cleaned team members", cleanedTeamMembers);

      return cleanedTeamMembers.length > 0 ? [arrayToCSV(cleanedTeams), arrayToCSV(cleanedTeamMembers)] : ["", ""];
    }

    return await downloadToCsv(); // ✅ Return CSV data to Node.js
  });

  console.log("results:", results); // ✅ Should now have CSV content

  if (!fs.existsSync("output")) fs.mkdirSync("output"); // Ensure directory exists
  fs.writeFileSync("output/teams.csv", results[0]);
  fs.writeFileSync("output/members.csv", results[1]);

  console.log("CSV saved to output/members.csv");
  console.log("Closing browser...");
  await browser.close();
})();
