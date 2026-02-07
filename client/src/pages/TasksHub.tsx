import { Link } from "react-router-dom";

const TasksHub = () => {
  return (
    <section className="hub-page">
      <header>
        <h2>Tasks</h2>
        <p>Track work across boards and stay aligned on priorities.</p>
      </header>
      <div className="state-card">
        <p>Select a project to view its task board.</p>
        <Link className="primary-button" to="/dashboard">
          Browse projects
        </Link>
      </div>
    </section>
  );
};

export default TasksHub;
