export interface User {
  id: string;
  username: string;
}

export interface TodoList {
  id: string;
  userId: string;
  name: string;
}

export interface TodoItem {
  id: string;
  listId: string;
  text: string;
  completed: boolean;
}

class Store {
  users: User[] = [];
  lists: TodoList[] = [];
  items: TodoItem[] = [];

  constructor() {
    // Initial demo data
    const demoUser = { id: "user1", username: "demo" };
    this.users.push(demoUser);

    const demoList = { id: "list1", userId: "user1", name: "General Tasks" };
    this.lists.push(demoList);

    this.items.push(
      { id: "item1", listId: "list1", text: "Integrate Provar Design System", completed: true },
      { id: "item2", listId: "list1", text: "Implement Bun Full-stack server", completed: true },
      { id: "item3", listId: "list1", text: "Complete Frontend development", completed: false }
    );
  }

  // Auth
  getUser(username: string) {
    return this.users.find(u => u.username === username);
  }

  addUser(username: string) {
    const newUser = { id: Math.random().toString(36).substr(2, 9), username };
    this.users.push(newUser);
    return newUser;
  }

  // Lists
  getLists(userId: string) {
    return this.lists.filter(l => l.userId === userId);
  }

  addList(userId: string, name: string) {
    const newList = { id: Math.random().toString(36).substr(2, 9), userId, name };
    this.lists.push(newList);
    return newList;
  }

  deleteList(listId: string) {
    this.lists = this.lists.filter(l => l.id !== listId);
    this.items = this.items.filter(i => i.listId !== listId);
  }

  // Items
  getItems(listId: string) {
    return this.items.filter(i => i.listId === listId);
  }

  addItem(listId: string, text: string) {
    const newItem = { id: Math.random().toString(36).substr(2, 9), listId, text, completed: false };
    this.items.push(newItem);
    return newItem;
  }

  updateItem(itemId: string, updates: Partial<TodoItem>) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      Object.assign(item, updates);
    }
    return item;
  }

  deleteItem(itemId: string) {
    this.items = this.items.filter(i => i.id !== itemId);
  }
}

export const store = new Store();
