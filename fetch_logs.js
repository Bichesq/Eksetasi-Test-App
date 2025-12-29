const AWS = require('aws-sdk');
const fs = require('fs');

AWS.config.update({region: 'us-east-1'});
const cloudwatchlogs = new AWS.CloudWatchLogs();

async function getLogs() {
    // Fetch last 30 minutes to cover the recent attempt
    const startTime = Date.now() - 30 * 60 * 1000; 
    console.log(`Fetching logs since ${new Date(startTime).toISOString()}...`);

    let allEvents = [];
    let nextToken = null;

    do {
        const params = {
            logGroupName: '/ecs/worker/dev',
            startTime: startTime,
            interleaved: true,
            nextToken: nextToken
        };

        try {
            const data = await cloudwatchlogs.filterLogEvents(params).promise();
            if (data.events) {
                allEvents = allEvents.concat(data.events);
            }
            nextToken = data.nextToken;
        } catch (err) {
            console.error("Error fetching logs:", err);
            break;
        }
    } while (nextToken);

    console.log(`Found ${allEvents.length} total events.`);

    // Sort by timestamp
    allEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    // Find index of the validation error
    const errorIndex = allEvents.findIndex(e => e.message.includes('Parameter validation failed'));
    
    if (errorIndex !== -1) {
        console.log(`Found validation error at index ${errorIndex}. Printing context:`);
        // Print 50 lines before and 10 after
        const start = Math.max(0, errorIndex - 50);
        const end = Math.min(allEvents.length, errorIndex + 10);
        
        allEvents.slice(start, end).forEach(e => {
            console.log(`[${new Date(e.timestamp).toISOString()}] ${e.message.trim()}`);
        });
    } else {
        console.log("No 'Parameter validation failed' error found in the fetched logs.");
    }
}

getLogs();
