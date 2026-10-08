CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  due_date DATE,
  image_url VARCHAR(512),
  owner_id INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE due_date_reminders (
  task_id INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_roadmaps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  document_url VARCHAR(512),
  current_day INTEGER NOT NULL DEFAULT 1,
  total_days INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roadmap_days (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER NOT NULL REFERENCES learning_roadmaps(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  topics TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (roadmap_id, day_number)
);

CREATE INDEX idx_learning_roadmaps_user_id ON learning_roadmaps(user_id);
CREATE INDEX idx_learning_roadmaps_status ON learning_roadmaps(status);
CREATE INDEX idx_roadmap_days_status ON roadmap_days(status);

CREATE TABLE roadmap_email_logs (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER NOT NULL REFERENCES learning_roadmaps(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  sent_date DATE NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (roadmap_id, day_number, sent_date)
);
