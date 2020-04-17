const API_KEY = '';

chrome.runtime.onMessage.addListener(function(message) {
    console.log('message received:', message);

    switch (message.type) {
        case 'inject-parser':
            chrome.tabs.executeScript({ file: 'js/parser.js' });
            break;
        // add data from content script to calendar as event
        case 'schedule-data':
            addEvents(message.data);
            break;
        case 'error':
            sendMessage('display-error', message.data);
            break;
    }
});

function addEvents(events) {
    chrome.identity.getAuthToken({ 'interactive': true }, async function(token) {
        const calendarList = await listCalendars(token);
        const classesCalendar = calendarList.items.find(calendar => calendar.summary == 'Classes');
        let classesCalendarID;

        if (classesCalendar) {
            sendMessage('display-success', 'Found Classes calendar');
            classesCalendarID = classesCalendar.id;
        } else {
            sendMessage('display-success', 'Classes calendar not found, creating it...');
            const result = await insertCalendar('Classes', token);

            if (!result.error) {
                sendMessage('display-success', 'Created Classes calendar');
                classesCalendarID = result.id;
            } else {
                sendMessage('display-error', `Code: ${result.error.code}, Message: ${result.error.message}`);
                return;
            }
        }
        
        console.log('classesCalendarID:', classesCalendarID);

        const existingEvents = await listEvents(classesCalendarID, token);
        
        console.log('existing events:', existingEvents);

        const totalEventsToAdd = existingEvents.items.length > 0 ? events.length - existingEvents.items.length : events.length;

        let eventsAdded = 0;
        let errorsOccurred = false;

        for (const event of events) {
            if (existingEvents.items.find(existingEvent => event.summary == existingEvent.summary))
                continue;
            
            let result = await insertEvent(event, classesCalendarID, token);

            console.log(event.summary, result);

            if (result.status == 'confirmed') {
                eventsAdded++;
                sendMessage('display-success', `[${eventsAdded} of ${totalEventsToAdd}] ${event.summary} has been added!`);
                sendMessage('completeness-fraction', eventsAdded / totalEventsToAdd);
            } else if (result.error) {
                sendMessage('display-error', `Code: ${result.error.code}, Message: ${result.error.message}`);
                errorsOccurred = true;
            }
        }

        if (!eventsAdded && !errorsOccurred) {
            sendMessage('display-success', 'Events have already been added.');
            sendMessage('completeness-fraction', 1);
        } else if (!eventsAdded && errorsOccurred)
            sendMessage('display-error', 'No events could be added.');
        else if (eventsAdded && errorsOccurred) {
            sendMessage('display-error', `${totalEventsToAdd - eventsAdded} events could not be added.`);
            sendMessage('completeness-fraction', 1);
        }
    });
}