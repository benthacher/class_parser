(async function() {
    console.log('class parser has been injected!');

    if (!Array.from(document.querySelectorAll('*')).some(elem => elem.innerHTML.includes('Student Detail Schedule'))) {
        const error = 'Please click the extension button only from the Banner schedule website.';
        
        console.error(error);
        sendError(error);
        return;
    }

    // offset of Boston - offset of client timezone
    const TIMEZONE_OFFSET = 4 - new Date().getTimezoneOffset() / 60;

    const DAY_STRINGS = Object.freeze({
        'S': 'SU',
        'M': 'MO',
        'T': 'TU',
        'W': 'WE',
        'R': 'TH',
        'F': 'FR',
        'A': 'SA'
    });

    const removeTags = s => s.replace( /(<([^>]+)>)/ig, '');
    
    function getMetadata(table) {
        const titleData = table.querySelector('.captiontext').innerHTML.split(' - ');

        let data = {
            summary: titleData.length > 1 ? titleData[1] : titleData[0],
            description: titleData.length > 1 ? titleData[0] + '\n' : ''
        }

        for (const tr of table.querySelectorAll('tr')) {
            const ddlabel = tr.querySelector('.ddlabel');
            if (ddlabel.innerHTML == 'Assigned Instructor:') {
                data.description += `Professor: ${removeTags(tr.querySelector('.dddefault').innerHTML.trim()) || 'TBA'}`;
                return data;
            }
        }
    }

    function getTimeData(keys, tds) {
        const dateRange = tds[keys.indexOf('Date Range')].innerHTML.split(' - ');
        let timeRange = tds[keys.indexOf('Time')].innerHTML.split(' - ');
        const days = tds[keys.indexOf('Days')].innerHTML.split('');

        if (timeRange.length != 2)
            return null;

        timeRange = timeRange.map(time => {
            const colonIndex = time.indexOf(':');
            let hour = parseInt(time.substring(0, colonIndex));
            const mins = parseInt(time.substring(colonIndex + 1, colonIndex + 3));

            if (time.includes('pm') && (hour >= 1 && hour < 12))
                hour += 12;
            
            hour += TIMEZONE_OFFSET;

            return { hour, mins };
        });

        // get first day in the week the day starts minus start date
        let firstDate = new Date(dateRange[0]);
        const dayDifference = Object.keys(DAY_STRINGS).indexOf(days[0]) - firstDate.getDay();

        firstDate = new Date(firstDate.setDate(firstDate.getDate() + dayDifference));

        const startDateTime = new Date(firstDate.setHours(timeRange[0].hour, timeRange[0].mins)).toISOString();
        const endDateTime = new Date(firstDate.setHours(timeRange[1].hour, timeRange[1].mins)).toISOString();

        const byDay = days.map(day => DAY_STRINGS[day]).join(',');
        const until = new Date(dateRange[1]);

        return {
            location: removeTags(tds[keys.indexOf('Where')].innerHTML),
            start: {
                dateTime: startDateTime,
                timeZone: 'America/New_York'
            },
            end: {
                dateTime: endDateTime,
                timeZone: 'America/New_York'
            },
            recurrence: [
                `RRULE:FREQ=WEEKLY;\
                 WKST=SU;\
                 UNTIL=${new Date(until.setDate(until.getDate() + 1)).toISOString().replace(/:|-|(\.000)(?=\Z)/g, '')};\
                 BYDAY=${byDay}`
            ]
        };
    }

    function sendError(e) {
        chrome.runtime.sendMessage({
            type: 'error',
            data: e
        });
    }

    // get everything on banner into a nice array
    let events = [];

    // get all data-display-tables in the pagebodydiv
    const dataDisplayTables = document.querySelector('.pagebodydiv').querySelectorAll('.datadisplaytable');

    try {
        Array.from(dataDisplayTables).forEach((table, index) => {
            // only find the scheduled meeting times table for time data, then use the table above for metadata
            if (!table.querySelector('.captiontext').innerHTML.includes('Scheduled Meeting Times'))
                return;
            
            const metadata = getMetadata(dataDisplayTables[index - 1]);
            const timeDataElem = table;
            
            const trs = timeDataElem.querySelectorAll('tr');

            // get keys for time data from table header element innerHTML
            const keys = Array.from(trs[0].querySelectorAll('.ddheader')).map(th => th.innerHTML);

            // using indexed for loops with all of ES8 is kinda gross but for now that's how it be
            for (let i = 1; i < trs.length; i++) {
                const tds = trs[i].querySelectorAll('.dddefault');
                
                const timeData = getTimeData(keys, tds);

                if (!timeData)
                    continue;

                let classEvent = { ...metadata, ...timeData };

                // if type is Final Exam, add that to title
                if (tds[keys.indexOf('Type')].innerHTML.includes('Final'))
                    classEvent.summary = `Final Exam for ${classEvent.summary}`;
                
                events.push(classEvent);
            }
        });
    } catch (e) {
        console.error(e);
        sendError(e);
    }

    chrome.runtime.sendMessage({
        type: 'schedule-data',
        data: events
    });

    console.log('Schedule data sent:', events);
})();