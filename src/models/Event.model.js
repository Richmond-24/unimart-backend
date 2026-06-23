const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  organizer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location:    { type: String, required: true },
  date:        { type: Date, required: true },
  dateLabel:   { type: String, default: '' },           // "Today, 8pm"
  price:       { type: Number, default: 0 },
  isFree:      { type: Boolean, default: false },
  image:       { type: String, default: '' },
  badge:       { type: String, default: '' },
  attending:   { type: Number, default: 0 },
  description: { type: String, default: '' },
  ticketLink:  { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
  university:  { type: String, default: '' },
  rsvpList:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);
