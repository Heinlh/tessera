import React from 'react';
import { useParams } from 'react-router-dom';

function EventDetail() {
  const { id } = useParams(); 

  return (
    <div>
      <h1>Event Detail Page</h1>
      <p>Showing details for event ID: {id}</p>
      <p>This is a placeholder page</p>
    </div>
  );
}

export default EventDetail;