// HighchartBubble.jsx
import React, { useEffect, useRef } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

const HighchartBubble = ({ config }) => {
  const chartComponentRef = useRef(null);

  useEffect(() => {
    if (chartComponentRef.current && config) {
      chartComponentRef.current.chart.update(config);
    }
  }, [config]);

  if (!config) return null;

  return (
    <div className="highchart-bubble">
      <HighchartsReact
        highcharts={Highcharts}
        options={config}
        ref={chartComponentRef}
      />
    </div>
  );
};

export default HighchartBubble;