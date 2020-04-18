const API_KEY = '';

function sendMessage(type, data) {
    chrome.runtime.sendMessage({
        type,
        data
    });
}

async function listCalendars(authToken) {
    return await get(`https://www.googleapis.com/calendar/v3/users/me/calendarList?key=${API_KEY}`, authToken);
}

async function insertCalendar(calendarSummary, authToken) {
    return await post(`https://www.googleapis.com/calendar/v3/calendars?key=${API_KEY}`, { "summary": calendarSummary }, authToken);
}

async function changeCalendarColor(calendarID, color, textColor, authToken) {
    const body = {
        "backgroundColor": color,
        "foregroundColor": textColor,
        "hidden": false,
        "selected": true
    };

    return await patch(`https://www.googleapis.com/calendar/v3/users/me/calendarList/${calendarID}?colorRgbFormat=true&key=${API_KEY}`, body, authToken);
}

async function insertEvent(event, calendarID, authToken) {
    return await post(`https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events?key=${API_KEY}`, event, authToken);
}

async function listEvents(calendarID, authToken) {
    return await get(`https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events?key=${API_KEY}`, authToken);
}

async function get(url, authToken) {
    const headers = new Headers({
        'Authorization' : 'Bearer ' + authToken,
        'Accept': 'application/json',
    });

    const queryParams = {
        method: 'GET',
        headers
    };
    
    const response = await fetch(url, queryParams);
    return await response.json();
}

async function post(url, body, authToken) {
    const headers = new Headers({
        'Authorization' : 'Bearer ' + authToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    });

    const queryParams = {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    };
    
    const response = await fetch(url, queryParams);
    return await response.json();
}

async function patch(url, body, authToken) {
    const headers = new Headers({
        'Authorization' : 'Bearer ' + authToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    });

    const queryParams = {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
    };
    
    const response = await fetch(url, queryParams);
    return await response.json();
}