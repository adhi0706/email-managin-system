import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Save, Trash2, Send, Plus, X, CheckCircle, AlertCircle, Loader, Paperclip } from 'lucide-react';

interface Draft {
  _id: string;
  subject: string;
  body: string;
  createdAt: string;
}

interface Client {
  _id: string;
  slno: number;
  name: string;
  email: string;
  company: string;
}

interface CustomField {
  keyword: string;
  value: string;
}

export default function ComposerPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectionMode, setSelectionMode] = useState<'checkbox' | 'range' | 'slno'>('checkbox');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [slnoInput, setSlnoInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [delay, setDelay] = useState(15);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDrafts();
    loadClients();
  }, []);

  const loadDrafts = async () => {
    try {
      const response = await api.get('/emails/drafts');
      setDrafts(response.data || []);
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  };

  const loadClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };


  const handleSaveDraft = async () => {
    if (!subject.trim() || !body.trim()) {
      setMessage({ type: 'error', text: 'Subject and body are required' });
      return;
    }

    try {
      await api.post('/emails/drafts', { subject, body });
      setMessage({ type: 'success', text: 'Draft saved successfully!' });
      loadDrafts();
      setSubject('');
      setBody('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save draft' });
    }
  };

  const handleLoadDraft = (draft: Draft) => {
    setSubject(draft.subject);
    setBody(draft.body);
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await api.delete(`/emails/drafts/${id}`);
      loadDrafts();
      setMessage({ type: 'success', text: 'Draft deleted' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete draft' });
    }
  };

  const handleSelectByRange = async () => {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);

    if (isNaN(start) || isNaN(end) || start > end) {
      setMessage({ type: 'error', text: 'Invalid range: Start SL No must be less than or equal to End SL No' });
      return;
    }

    // Reload clients if not yet loaded (e.g. backend was down on page load)
    let currentClients = clients;
    if (currentClients.length === 0) {
      try {
        const response = await api.get('/clients');
        currentClients = response.data || [];
        setClients(currentClients);
      } catch {
        setMessage({ type: 'error', text: 'Could not load clients. Make sure the backend server is running.' });
        return;
      }
    }

    const newSelected = new Set<string>();
    currentClients.forEach(client => {
      if (client.slno >= start && client.slno <= end) {
        newSelected.add(client._id);
      }
    });

    setSelectedClients(newSelected);

    if (newSelected.size === 0) {
      setMessage({ type: 'error', text: `No clients found in SL No range ${start}–${end}` });
    } else {
      setMessage({ type: 'success', text: `Selected ${newSelected.size} client${newSelected.size !== 1 ? 's' : ''} in range ${start}–${end}` });
    }
  };

  const handleSelectBySlno = async () => {
    const slnos = slnoInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

    if (slnos.length === 0) {
      setMessage({ type: 'error', text: 'Please enter valid SL numbers separated by commas (e.g. 1, 3, 5)' });
      return;
    }

    // Reload clients if not yet loaded (e.g. backend was down on page load)
    let currentClients = clients;
    if (currentClients.length === 0) {
      try {
        const response = await api.get('/clients');
        currentClients = response.data || [];
        setClients(currentClients);
      } catch {
        setMessage({ type: 'error', text: 'Could not load clients. Make sure the backend server is running.' });
        return;
      }
    }

    const newSelected = new Set<string>();
    currentClients.forEach(client => {
      if (slnos.includes(client.slno)) {
        newSelected.add(client._id);
      }
    });

    setSelectedClients(newSelected);

    const notFound = slnos.filter(n => !currentClients.some(c => c.slno === n));
    if (newSelected.size === 0) {
      setMessage({ type: 'error', text: `No clients found with SL No: ${slnos.join(', ')}` });
    } else if (notFound.length > 0) {
      setMessage({ type: 'success', text: `Selected ${newSelected.size} client${newSelected.size !== 1 ? 's' : ''}. SL No not found: ${notFound.join(', ')}` });
    } else {
      setMessage({ type: 'success', text: `Selected ${newSelected.size} client${newSelected.size !== 1 ? 's' : ''}` });
    }
  };

  const handleSendEmails = async () => {
    if (selectedClients.size === 0) {
      setMessage({ type: 'error', text: 'Please select at least one client' });
      return;
    }

    if (selectedClients.size > 100) {
      setMessage({ type: 'error', text: 'Cannot send more than 100 emails per batch' });
      return;
    }

    if (!subject.trim() || !body.trim()) {
      setMessage({ type: 'error', text: 'Subject and body are required' });
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      // Find full client objects for selected IDs
      const selectedClientData = clients.filter(c => selectedClients.has(c._id));

      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('clients', JSON.stringify(selectedClientData));
      formData.append('delay', delay.toString());

      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await api.post('/emails/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const isError = response.data.failed > 0;
      setMessage({
        type: isError ? 'error' : 'success',
        text: `Campaign completed. Sent: ${response.data.sent}, Failed: ${response.data.failed}. ${isError ? 'Check server .env email credentials.' : ''
          }`,
      });
      if (!isError) {
        setSelectedClients(new Set());
        setAttachments([]);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || error.message || 'Failed to send emails',
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { keyword: '', value: '' }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, field: 'keyword' | 'value', value: string) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
            }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Email Composer</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Email subject..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Email body... Use placeholders like {{name}}, {{email}}, {{company}}"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">Available Placeholders:</p>
                <div className="flex flex-wrap gap-2">
                  {['{{name}}', '{{email}}', '{{company}}'].map(placeholder => (
                    <code key={placeholder} className="px-2 py-1 bg-white text-blue-700 rounded text-xs">
                      {placeholder}
                    </code>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Custom Fields</label>
                  <button
                    onClick={addCustomField}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {customFields.map((field, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={field.keyword}
                        onChange={(e) => updateCustomField(index, 'keyword', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Keyword (e.g., custom_field)"
                      />
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Value"
                      />
                      <button
                        onClick={() => removeCustomField(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Attachments</label>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Paperclip className="w-4 h-4" />
                    Add File
                  </button>
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-700 truncate">{file.name}</span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Send Delay</label>
                <select
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value={2}>Fast (2 seconds) - High Spam Risk</option>
                  <option value={15}>15 seconds - Medium Spam Risk</option>
                  <option value={30}>30 seconds - Low Spam Risk</option>
                  <option value={60}>1 minute - Safest</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveDraft}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  Save Draft
                </button>
                <button
                  onClick={handleSendEmails}
                  disabled={sending || selectedClients.size === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send to {selectedClients.size} Client{selectedClients.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Select Recipients</h3>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectionMode('checkbox')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectionMode === 'checkbox'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Checkbox
              </button>
              <button
                onClick={() => setSelectionMode('range')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectionMode === 'range'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Range
              </button>
              <button
                onClick={() => setSelectionMode('slno')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectionMode === 'slno'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                By SL No
              </button>
              <button
                onClick={() => setSelectedClients(new Set(clients.map(c => c._id)))}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedClients(new Set())}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            </div>

            {selectionMode === 'range' && (
              <div className="mb-4 space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start SL No</label>
                    <input
                      type="number"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">End SL No</label>
                    <input
                      type="number"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="10"
                    />
                  </div>
                  <button
                    onClick={handleSelectByRange}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {selectedClients.size > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''} selected:
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {clients.filter(c => selectedClients.has(c._id)).map(client => (
                        <div key={client._id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                          <span className="text-blue-700 font-medium w-8">#{client.slno}</span>
                          <span className="text-gray-800 flex-1">{client.name}</span>
                          <span className="text-gray-500 text-xs">{client.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectionMode === 'slno' && (
              <div className="mb-4 space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      SL Numbers (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={slnoInput}
                      onChange={(e) => setSlnoInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="1, 5, 10, 15"
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectBySlno()}
                    />
                  </div>
                  <button
                    onClick={handleSelectBySlno}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {selectedClients.size > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''} selected:
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {clients.filter(c => selectedClients.has(c._id)).map(client => (
                        <div key={client._id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                          <span className="text-blue-700 font-medium w-8">#{client.slno}</span>
                          <span className="text-gray-800 flex-1">{client.name}</span>
                          <span className="text-gray-500 text-xs">{client.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectionMode === 'checkbox' && (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {clients.map(client => (
                  <label key={client._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedClients.has(client._id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedClients);
                        if (e.target.checked) {
                          newSelected.add(client._id);
                        } else {
                          newSelected.delete(client._id);
                        }
                        setSelectedClients(newSelected);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">
                      {client.slno}. {client.name} ({client.email})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Saved Drafts</h3>
            <div className="space-y-3">
              {drafts.map(draft => (
                <div key={draft._id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{draft.subject}</h4>
                    <button
                      onClick={() => handleDeleteDraft(draft._id)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mb-3 line-clamp-2">{draft.body}</p>
                  <button
                    onClick={() => handleLoadDraft(draft)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Load Draft
                  </button>
                </div>
              ))}
              {drafts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No saved drafts</p>
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
