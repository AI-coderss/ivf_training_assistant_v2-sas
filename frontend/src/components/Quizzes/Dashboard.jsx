// src/components/Quizzes/Dashboard.jsx
import React, { useEffect, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import axios from "axios";
import "../../styles/Dashboard.css";

const BACKEND_URL = "https://ivf-backend-server.onrender.com/quiz-performance"; // Adjust if needed

const Dashboard = ({ userId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data once on mount (after quiz submission)
    axios
      .get(BACKEND_URL, {
        params: { user_id: userId }, // If you want to filter per user, adjust as needed
      })
      .then((res) => setData(res.data))
      .catch((err) => {
        setData(null);
        console.error("Failed to load performance data:", err);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="dashboard-loading">Loading your performance...</div>;
  if (!data) return <div className="dashboard-loading error">Unable to load dashboard data.</div>;

  const { attempts, scores, correct_answers, durations, timestamps } = data;

  // Score Line Chart
  const scoreChart = {
    chart: { type: "line", height: 300 },
    title: { text: "📈 Score Over Time" },
    xAxis: {
      categories: timestamps.map(ts => new Date(ts).toLocaleDateString()),
      title: { text: "Date" },
    },
    yAxis: { max: 100, title: { text: "Score (%)" } },
    tooltip: { valueSuffix: "%" },
    legend: { enabled: false },
    series: [{ name: "Score", data: scores }],
    credits: { enabled: false },
    responsive: { rules: [{ condition: { maxWidth: 600 }, chartOptions: { chart: { height: 200 } } }] }
  };

  // Correct Answers Column Chart
  const correctAnswersChart = {
    chart: { type: "column", height: 300 },
    title: { text: "🧠 Correct Answers by Attempt" },
    xAxis: { categories: attempts.map((a, i) => `Attempt ${i + 1}`), title: { text: "Attempt" } },
    yAxis: { title: { text: "Correct Answers" }, max: 20 }, // Change if your quizzes use more/less questions
    tooltip: { valueSuffix: " correct" },
    legend: { enabled: false },
    series: [{ name: "Correct Answers", data: correct_answers }],
    credits: { enabled: false },
    responsive: { rules: [{ condition: { maxWidth: 600 }, chartOptions: { chart: { height: 200 } } }] }
  };

  // Duration Bar Chart
  const durationChart = {
    chart: { type: "bar", height: 300 },
    title: { text: "⏱️ Time Taken per Attempt" },
    xAxis: { categories: attempts.map((a, i) => `Attempt ${i + 1}`), title: { text: "Attempt" } },
    yAxis: { title: { text: "Minutes" } },
    tooltip: { valueSuffix: " mins" },
    legend: { enabled: false },
    series: [{ name: "Duration", data: durations }],
    credits: { enabled: false },
    responsive: { rules: [{ condition: { maxWidth: 600 }, chartOptions: { chart: { height: 200 } } }] }
  };

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">📊 Your Performance Overview</h2>

      <div className="chart-wrapper">
        <HighchartsReact highcharts={Highcharts} options={scoreChart} />
      </div>

      <div className="chart-wrapper">
        <HighchartsReact highcharts={Highcharts} options={correctAnswersChart} />
      </div>

      <div className="chart-wrapper">
        <HighchartsReact highcharts={Highcharts} options={durationChart} />
      </div>
    </div>
  );
};

export default Dashboard;

