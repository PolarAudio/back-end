// standalone-backend/googleCalendar.js
const { google } = require('googleapis');
const serviceAccount = require('./serviceAccountKey.json');
const moment = require('moment-timezone');

const calendar = google.calendar('v3');
const calendarId = 'eae066e12bee90f37aab773e16d2e1377da8dfe432da4a1740f89c4bfb2ad76c@group.calendar.google.com';

const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/calendar']
);

const createCalendarEvent = async (bookingId, bookingData, userEmail) => {
    const equipmentList = formatEquipmentForCalendar(bookingData.equipment);
    const paymentStatus = formatPaymentStatusForCalendar(bookingData.paymentStatus);

    const startDateTime = moment.tz(`${bookingData.date}T${bookingData.time}`, 'YYYY-MM-DDTHH:mm', 'Asia/Makassar');
    const endDateTime = moment.tz(startDateTime).add(bookingData.duration, 'hours');

    const event = {
        summary: `Booking: ${bookingData.userName}`,
        description: `Booking ID: ${bookingId}\nUser: ${bookingData.userName}\nEmail: ${userEmail}\nPayment: ${paymentStatus}\nEquipment: ${equipmentList}`,
        start: {
            dateTime: startDateTime.format(),
            timeZone: 'Asia/Makassar',
        },
        end: {
            dateTime: endDateTime.format(),
            timeZone: 'Asia/Makassar',
        },
    };

    try {
        const res = await calendar.events.insert({ auth, calendarId, resource: event });
        console.log('Event created: ', res.data.htmlLink);
        return res.data.id;
    } catch (error) {
        console.error('Error creating calendar event:', error);
        throw error; // Re-throw to be caught by the caller
    }
};

const updateCalendarEvent = async (googleEventId, bookingData, userEmail) => {
    const equipmentList = formatEquipmentForCalendar(bookingData.equipment);
    const paymentStatus = formatPaymentStatusForCalendar(bookingData.paymentStatus);

    const startDateTime = moment.tz(`${bookingData.date}T${bookingData.time}`, 'YYYY-MM-DDTHH:mm', 'Asia/Makassar');
    const endDateTime = moment.tz(startDateTime).add(bookingData.duration, 'hours');

    const event = {
        summary: `Booking: ${bookingData.userName}`,
        description: `User: ${bookingData.userName}\nEmail: ${userEmail}\nPayment: ${paymentStatus}\nEquipment: ${equipmentList}`,
        start: {
            dateTime: startDateTime.format(),
            timeZone: 'Asia/Makassar',
        },
        end: {
            dateTime: endDateTime.format(),
            timeZone: 'Asia/Makassar',
        },
    };

    try {
        const res = await calendar.events.update({ auth, calendarId, eventId: googleEventId, resource: event });
        console.log('Event updated: ', res.data.htmlLink);
    } catch (error) {
        console.error('Error updating calendar event:', error);
        throw error; // Re-throw to be caught by the caller
    }
};

const deleteCalendarEvent = async (googleEventId) => {
    try {
        await calendar.events.delete({ auth, calendarId, eventId: googleEventId });
        console.log('Event deleted');
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        throw error; // Re-throw to be caught by the caller
    }
};

const formatEquipmentForCalendar = (equipment) => {
    if (equipment && equipment.length > 0) {
        return equipment.map(item => item.name || item.id || 'Unknown Equipment').join(', ');
    }
    return 'None';
};

const formatPaymentStatusForCalendar = (paymentStatus) => {
    return paymentStatus || 'N/A';
};

module.exports = { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, formatEquipmentForCalendar, formatPaymentStatusForCalendar };
