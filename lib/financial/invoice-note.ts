export type InvoiceNoteChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
};

export type InvoiceCycleNote = {
  id: string;
  content: string;
  checklist: InvoiceNoteChecklistItem[];
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};
