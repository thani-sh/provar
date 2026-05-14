import React, { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";
import { Input } from "./components/Input";
import { Card } from "./components/Card";
import { StatusChip } from "./components/StatusChip";

interface User {
  id: string;
  username: string;
}

interface TodoList {
  id: string;
  name: string;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [lists, setLists] = useState<TodoList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [newListName, setNewListName] = useState("");
  const [newItemText, setNewItemText] = useState("");

  const login = async () => {
    if (!username) return;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    const data = await res.json() as User;
    setUser(data);
  };

  useEffect(() => {
    if (user) {
      fetch(`/api/lists?userId=${user.id}`)
        .then(res => res.json())
        .then((data: TodoList[]) => {
          setLists(data);
          if (data.length > 0) setActiveListId(data[0]!.id);
        });
    }
  }, [user]);

  useEffect(() => {
    if (activeListId) {
      fetch(`/api/items?listId=${activeListId}`)
        .then(res => res.json())
        .then((data: TodoItem[]) => setItems(data));
    }
  }, [activeListId]);

  const addList = async () => {
    if (!newListName || !user) return;
    const res = await fetch("/api/lists", {
      method: "POST",
      body: JSON.stringify({ userId: user.id, name: newListName }),
    });
    const newList = await res.json() as TodoList;
    setLists([...lists, newList]);
    setNewListName("");
    setActiveListId(newList.id);
  };

  const addItem = async () => {
    if (!newItemText || !activeListId) return;
    const res = await fetch("/api/items", {
      method: "POST",
      body: JSON.stringify({ listId: activeListId, text: newItemText }),
    });
    const newItem = await res.json() as TodoItem;
    setItems([...items, newItem]);
    setNewItemText("");
  };

  const toggleItem = async (item: TodoItem) => {
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: !item.completed }),
    });
    const updated = await res.json() as TodoItem;
    setItems(items.map(i => (i.id === item.id ? updated : i)));
  };

  const deleteItem = async (id: string) => {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    setItems(items.filter(i => i.id !== id));
  };

  if (!user) {
    return (
      <div className="login-screen">
        <Card title="Login to Todo Demo" className="login-card">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Input 
              placeholder="Username" 
              value={username} 
              onChange={e => setUsername((e.target as HTMLInputElement).value)}
              onKeyDown={e => e.key === "Enter" && login()}
            />
            <Button onClick={login}>Login / Register</Button>
          </div>
        </Card>
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="sidebar-header">
        <h3 style={{ fontSize: "14px", color: "var(--on-surface-variant)" }}>My Lists</h3>
      </div>
      <div className="list-nav">
        {lists.map(list => (
          <div 
            key={list.id} 
            className={`list-item ${activeListId === list.id ? "active" : ""}`}
            onClick={() => setActiveListId(list.id)}
          >
            {list.name}
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <Input 
          placeholder="New List..." 
          value={newListName} 
          onChange={e => setNewListName((e.target as HTMLInputElement).value)}
          onKeyDown={e => e.key === "Enter" && addList()}
          className="sidebar-input"
        />
        <Button variant="ghost" onClick={addList} style={{ width: "100%", marginTop: "8px" }}>Add List</Button>
      </div>
    </>
  );

  const activeList = lists.find(l => l.id === activeListId);

  return (
    <Layout sidebar={sidebarContent}>
      <header className="content-header">
        <div>
          <h2>{activeList?.name || "Select a list"}</h2>
          <p style={{ color: "var(--on-surface-variant)", fontSize: "14px" }}>
            Logged in as <strong>{user.username}</strong>
          </p>
        </div>
        <StatusChip label="Connected" variant="success" />
      </header>

      <div className="task-section">
        <div className="add-task">
          <Input 
            placeholder="What needs to be done?" 
            value={newItemText} 
            onChange={e => setNewItemText((e.target as HTMLInputElement).value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
          />
          <Button onClick={addItem}>Add Task</Button>
        </div>

        <div className="task-list">
          {items.map(item => (
            <Card key={item.id} className="task-card">
              <div className="task-row">
                <input 
                  type="checkbox" 
                  checked={item.completed} 
                  onChange={() => toggleItem(item)}
                  className="task-checkbox"
                />
                <span className={`task-text ${item.completed ? "completed" : ""}`}>
                  {item.text}
                </span>
                <Button variant="ghost" onClick={() => deleteItem(item.id)} className="delete-btn">
                  &times;
                </Button>
              </div>
            </Card>
          ))}
          {items.length === 0 && (
            <div className="empty-state">No tasks in this list yet.</div>
          )}
        </div>
      </div>
    </Layout>
  );
}
