const Method = Object.freeze({
    ADD: 0,
    DELETE: 1
});

chrome.runtime.onMessage.addListener(function(message) {
    console.log('message received:', message);

    switch (message.type) {
        case 'inject-parser':
            chrome.tabs.executeScript({ file: 'js/parser.js' }, () => {
                const e = chrome.runtime.lastError;

                if (e)
                    sendMessage('display-error', e.message);
            });
            break;
        // add data from content script to calendar as event
        case 'schedule-data':
            getMethod().then(method => {
                processEvents(message.data, method);
            });

            break;
        case 'change-color':
            changeColor(message.data);
            break;
        case 'error':
            sendMessage('display-error', message.data);
            break;
    }
});

function changeColor({ color, textColor }) {
    sendMessage('display-success', 'Getting permission...');

    chrome.identity.getAuthToken({ 'interactive': true }, async function(token) {
        const e = chrome.runtime.lastError;

        if (!token) {
            sendMessage('display-error', e.message);
            return;
        }
        
        sendMessage('display-success', 'Granted!');

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

        let result = await changeCalendarColor(classesCalendarID, color, textColor, token);

        if (!result.error) {
            sendMessage('display-success', 'Changed Classes calendar color.');
            sendMessage('completeness-fraction', 1);
        } else {
            sendMessage('display-error', `Code: ${result.error.code}, Message: ${result.error.message}`);
            return;
        }
    });
}

function getMethod() {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'get-method' }, function(response) {
            resolve(response);
        });
    });
}

function processEvents(events, method) {
    sendMessage('display-success', 'Getting permission...');

    chrome.identity.getAuthToken({ 'interactive': true }, async function(token) {
        const e = chrome.runtime.lastError;

        if (!token) {
            sendMessage('display-error', e.message);
            return;
        }
        
        sendMessage('display-success', 'Granted!');

        const calendarList = await listCalendars(token);

        console.log(calendarList);

        if (calendarList.error) {
            sendMessage('display-error', `Code: ${calendarList.error.code}, Message: ${calendarList.error.message}`);
            return;
        }

        const classesCalendar = calendarList.items.find(calendar => calendar.summary == 'Classes');
        let classesCalendarID;

        if (classesCalendar) {
            sendMessage('display-success', 'Found Classes calendar');
            classesCalendarID = classesCalendar.id;
        } else {
            if (method == Method.ADD) {
                sendMessage('display-success', 'Classes calendar not found, creating it...');
                const result = await insertCalendar('Classes', token);

                if (!result.error) {
                    sendMessage('display-success', 'Created Classes calendar');
                    classesCalendarID = result.id;
                } else {
                    sendMessage('display-error', `Code: ${result.error.code}, Message: ${result.error.message}`);
                    return;
                }
            } else if (method == Method.DELETE) {
                sendMessage('display-success', 'Classes calendar not found, nothing to delete');
                return;
            }
        }
        
        const existingEvents = await listEvents(classesCalendarID, token);
        
        console.log('existing events:', existingEvents);
        
        if (method == Method.ADD)
            events = events.filter(event => !existingEvents.items.find(existingEvent => event.summary == existingEvent.summary));
        else if (method == Method.DELETE)
            events = existingEvents.items.filter(existingEvent => events.find(event => event.summary == existingEvent.summary));

        console.log('events post filter:', events);

        let eventsProcessed = 0;
        let errorsOccurred = false;
        let processString = '';

        if (method == Method.ADD)
            processString = 'added';
        else if (method == Method.DELETE)
            processString = 'deleted';

        for (const event of events) {
            let result;

            if (method == Method.ADD)
                result = await insertEvent(event, classesCalendarID, token);
            else if (method == Method.DELETE)
                result = await deleteEvent(event.id, classesCalendarID, token);

            console.log(event.summary, result);

            if ((typeof result == 'boolean' && result) || result.status == 'confirmed') {
                eventsProcessed++;
                sendMessage('display-success', `[${eventsProcessed} of ${events.length}] ${event.summary} has been ${processString}!`);
                sendMessage('completeness-fraction', eventsProcessed / events.length);
            } else if (result.error) {
                sendMessage('display-error', `Code: ${result.error.code}, Message: ${result.error.message}`);
                errorsOccurred = true;
            }
        }

        if (!eventsProcessed && !errorsOccurred) {
            sendMessage('display-success', `Events have already been ${processString}.`);
            sendMessage('completeness-fraction', 1);
        } else if (!eventsProcessed && errorsOccurred)
            sendMessage('display-error', `No events could be ${processString}.`);
        else if (eventsProcessed && errorsOccurred) {
            sendMessage('display-error', `${events.length - eventsProcessed} events could not be ${processString}.`);
            sendMessage('completeness-fraction', 1);
        }
    });
}