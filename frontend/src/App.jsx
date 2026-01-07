import React, { useState, useEffect } from 'react';

function App() {
  const [names, setNames] = useState([]);

  // Fetch names from the API on component mount
  useEffect(() => {
    fetch('http://localhost:5000/names')
      .then(response => response.json())
      .then(data => setNames(data))
      .catch(error => console.error('Error fetching names:', error));
  }, []);

  return (
    <div style={{ margin: '20px', fontFamily: 'Arial', backgroundColor: '#f0f0f0', color: '#333' }}>
      <h1>The Kings and Queens of Tessera</h1>
      <ul>
        {names.map((name, index) => (
          <li key={index} style={{ padding: '10px', backgroundColor: '#fff', marginBottom: '5px', color: '#333' }}>
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;