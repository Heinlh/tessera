import React, { Component } from 'react';
import SeatPicker from 'react-seat-picker';
import PropTypes from 'prop-types';
import './TesseraSeatPicker.css';

// Error boundary to catch any crashes from react-seat-picker
class SeatPickerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SeatPicker Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          <p>Unable to load seat picker. Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const TesseraSeatPicker = ({
  rows,
  maxReservableSeats = 0,
  alpha = false,
  addSeatCallback,
  removeSeatCallback = null,
  visible = true,
  selectedByDefault = false,
  loading = false,
  seatStyle = {},
  stageStyle = {},
  containerClassName = '',
  stageClassName = '',
  showStage = true,
  ...props
}) => {
  // Safety check - don't render SeatPicker if rows is empty or invalid
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return (
      <div className={`seats ${containerClassName}`}>
        {showStage && (
          <div className={`stages ${stageClassName}`} style={stageStyle}>
            <h3 className="stage">Stage</h3>
          </div>
        )}
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <p>No seats available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`seats ${containerClassName}`}>
      {showStage && (
        <div className={`stages ${stageClassName}`} style={stageStyle}>
          <h3 className="stage">Stage</h3>
        </div>
      )}
      <SeatPickerErrorBoundary>
        <SeatPicker
          rows={rows}
          maxReservableSeats={maxReservableSeats}
          alpha={alpha}
          addSeatCallback={addSeatCallback}
          removeSeatCallback={removeSeatCallback}
          visible={visible}
          selectedByDefault={selectedByDefault}
          loading={loading}
          {...props}
        />
      </SeatPickerErrorBoundary>
    </div>
  );
};

// Custom PropTypes validator to ensure each seat has an id
const seatShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  number: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  tooltip: PropTypes.string,
  isReserved: PropTypes.bool,
});

const rowShape = PropTypes.arrayOf(
  PropTypes.oneOfType([seatShape, PropTypes.oneOf([null])])
);

TesseraSeatPicker.propTypes = {
  rows: PropTypes.arrayOf(rowShape).isRequired,
  maxReservableSeats: PropTypes.number,
  alpha: PropTypes.bool,
  addSeatCallback: PropTypes.func.isRequired,
  removeSeatCallback: PropTypes.func,
  visible: PropTypes.bool,
  selectedByDefault: PropTypes.bool,
  loading: PropTypes.bool,
  seatStyle: PropTypes.object, // Custom styles for seats
  stageStyle: PropTypes.object, // Custom styles for the stage
  containerClassName: PropTypes.string, // Custom class for the container
  stageClassName: PropTypes.string, // Custom class for the stage
  showStage: PropTypes.bool, // Whether to show the built-in stage element
};

export default TesseraSeatPicker;