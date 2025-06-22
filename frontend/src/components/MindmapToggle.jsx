import React, { useState, useEffect } from "react";
import { Mindmap } from "@rileyy29/react-mindmap";
import "../styles/MindmapToggle.css"

const BACKEND_URL = "https://ivf-backend-server.onrender.com"; // ✅ Replace with your backend URL

const MindmapToggle = ({ handleNewMessage, topic = "IVF", sessionId }) => {
  const [open, setOpen] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMindmap = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/mindmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, session_id: sessionId }),
      });
      const data = await res.json();

      // 🧩 Convert server JSON -> Mindmap format
      const convert = (n) => ({
        id: n.id,
        x: 400 + Math.random() * 100,
        y: n.id * 150,
        width: 200,
        height: 80,
        type: n.id === 1 ? "ROOT" : "CHILD",
        node: { title: n.title },
        childNodes: n.children?.map(convert) || [],
      });

      setNodes([convert(data.nodes[0])]);
    } catch (err) {
      console.error("❌ Mindmap fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && nodes.length === 0 && !loading) {
      fetchMindmap();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="mindmap-toggle">
      <button
        className="toggle-btn"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "− Mindmap" : "+ Mindmap"}
      </button>

      {open && (
        <div className="mindmap-glass">
          {loading ? (
            <p className="loading-text">Loading mindmap...</p>
          ) : (
            <Mindmap
              draggable={true}
              nodes={nodes}
              onNodesChange={setNodes}
              renderNode={(node) => (
                <button
                  className="mindmap-node-btn"
                  onClick={() =>
                    handleNewMessage({ text: node.node.title })
                  }
                >
                  {node.node.title}
                </button>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default MindmapToggle;

