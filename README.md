# 🏛️ Church Management System Powered by Agentic AI  

This project is an **AI-driven church management system** that simplifies administrative tasks such as member registration, ministry and activity tracking.  
Leveraging **Agentic AI**, the system employs multiple specialized agents to automate complex processes while maintaining strict security and access control.  


## ✨ Key Features  

- **AI-Powered Automation**:  
  - More than **10 AI agents**, each with a specific role, working together under a supervisory agent.  
  - Supports natural language queries for efficient data retrieval and management.  

- **Core Functionalities**:  
  - **Member Management**: Register and manage church members and attendees.  
  - **Ministry Tracking**: Organize ministries and their participants.  
  - **Attendance Tracking**: Record and monitor attendance for various church activities.  
  - **Intelligent Reporting**: Generate actionable reports based on complex queries.  


## 🛠️System Architecture Overview

- The system is designed with a fully conversational chat-based front end. The goal is for users to interact naturally with the system for all operations—whether retrieving reports, managing ministries, or updating records.
- At its core, the logic layer is built with a multi-agent AI system using LangGraph's agentic AI architecture. It features:
  - 10+ ReAct (Reason + Act) agents, each with a specific goal and specialized tools.
  - A supervisor agent that orchestrates workflows, ensuring seamless collaboration and execution.
- There is a dedicated security layer that governs all read, insert, update, and delete actions to ensure data consistency and access control to the database.

  
## 🛠️ Tech Stack  

- **Backend**: Node.js (Express.js)  
- **AI Frameworks**: LangChain, LangGraph  
- **LLM**: OpenAI  
- **Database**: PostgreSQL  
- **Deployment**: Heroku  


## 🧠 AI in Action  

One of the most powerful aspects of the system is its ability to process natural language queries and generate accurate reports.  

**Example Query:**  
"Give me a report of people between 15 and 20 years old who have never attended a youth group activity."
The Reports Agent performs the following steps:
- Understands the database structure using intelligent tools.
- Generates and validates the SQL query.
- Executes it securely within predefined constraints.
- Processes the results and generates an Excel report if requested.
- The system can even execute follow-up actions like: "Link all of them to the youth group small group."


## 🔒 Security Measures
Security is a top priority in this system, ensuring that AI autonomy is balanced with strict control mechanisms:

- **Predefined Queries**: Agents can only perform inserts, updates, or deletions via predefined queries, providing only the necessary parameters.
- **Role-Based Access**: Users can only view personal information if they are leaders of the group the member belongs to.
- **Audit Logging**: Every action is logged for accountability and transparency.
- **Critical Admin Functions**: Essential tasks such as granting app access, updating passwords, and reviewing audit logs remain under manual control.


## 📧 Contact
If you have any questions or suggestions, feel free to reach out via  [LinkedIn](https://www.linkedin.com/in/josias-deleu/).
