import React from "react";
import "../styles/BaseOrb.scss";


const BaseOrb = () => (
  <div className="wrap">
    {Array.from({ length: 300 }).map((_, i) => (
      <div key={i} className="particle"></div>
    ))}
  </div>
);

export default BaseOrb;