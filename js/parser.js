(function() {
    console.log('class parser has been injected!');

    //            offset of Boston  + offset of client timezone
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

    /*  
        needed data:
            class name ✓
            location ✓
            time of day ✓
            recurrence ✓
            professor ✓


    */
    function getMetadata(table) {
        const titleData = table.querySelector('.captiontext').innerHTML.split(' - ');

        let data = {
            summary: titleData[1],
            description: titleData[0] + '\n'
        }

        for (const tr of table.querySelectorAll('tr')) {
            const ddlabel = tr.querySelector('.ddlabel');
            if (ddlabel.innerHTML == 'Assigned Instructor:') {
                data.description += 'Professor: ' + removeTags(tr.querySelector('.dddefault').innerHTML.trim());
                return data;
            }
        }
    }

    function getTimedata(tds) {
        const dateRange = tds[4].innerHTML.split(' - ');
        let timeRange = tds[1].innerHTML.split(' - ');
        const days = tds[2].innerHTML.split('');

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
            location: removeTags(tds[3].innerHTML),
            start: {
                dateTime: startDateTime,
                timeZone: 'America/New_York'
            },
            end: {
                dateTime: endDateTime,
                timeZone: 'America/New_York'
            },
            recurrence: [
                `RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=${new Date(until.setDate(until.getDate() + 1)).toISOString().replace(/:|-|(\.000)(?=\Z)/g, '')};BYDAY=${byDay}`
            ]
        };
    }

    // get literally everything on banner into a nice array
    let events = [];

    const dataDisplayTables = document.querySelectorAll('.datadisplaytable');

    for (let i = 1; i < dataDisplayTables.length; i += 2) {
        const metadata = dataDisplayTables[i];
        const timedata = dataDisplayTables[i + 1];
        
        const trs = timedata.querySelectorAll('tr');

        for (let i = 1; i < trs.length; i++) {
            const tds = trs[i].querySelectorAll('.dddefault');
            
            let classEvent = Object.assign({}, getMetadata(metadata), getTimedata(tds));

            // if type is Final Exam, add that to title
            if (tds[0].innerHTML == 'Final Exam')
                classEvent.summary = 'Final Exam for ' + classEvent.summary;
            
            events.push(classEvent);
        }
    }

    const message = {
        type: 'schedule-data',
        data: events
    };

    if (window.location.href.includes('https://wl11gp.neu.edu/')) {
        chrome.runtime.sendMessage(message);
        console.log('Schedule data sent:', (message));
    } else {
        const error = 'Please click the extension button only from the Banner schedule website.';
        console.error(error);
        chrome.runtime.sendMessage({
            type: 'error',
            data: error
        });
    }
})();

//new Date('Jan 06, 2020').toISOString();