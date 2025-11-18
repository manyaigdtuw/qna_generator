import React, { useEffect, useState } from "react";
import { getRow, generateRow, saveRow } from "../api";

export default function ShlokaEditor({ id, onSaved }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qaCount, setQaCount] = useState(4);
  const [generated, setGenerated] = useState(null);

  useEffect(() => {
    loadRow();
  }, [id]);

  async function loadRow() {
    setLoading(true);
    const data = await getRow(id);
    setRow(data);
    setGenerated(null);
    setLoading(false);
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      const out = await generateRow(id, qaCount);
      // out contains arrays: q_en,a_en,q_hi,a_hi,q_sa,a_sa
      setGenerated(out);
    } catch (e) {
      alert("Generation failed: " + (e?.message || e));
    }
    setLoading(false);
  }

  function updateGenerated(langKey, idx, value) {
    setGenerated(prev => {
      const copy = {...prev};
      copy[langKey][idx] = value;
      return copy;
    });
  }

  async function handleSave() {
    if (!generated) {
      alert("Nothing to save. Generate first.");
      return;
    }
    setLoading(true);
    try {
      await saveRow(id, generated);
      alert("Saved");
      onSaved();
    } catch (e) {
      alert("Save failed: " + (e?.message || e));
    }
    setLoading(false);
  }

  if (loading || !row) {
    return <div className="text-gray-600">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Shloka Editor</h1>
        <div className="mt-3">
          <div className="bg-white p-4 rounded shadow-sm">
            <div className="text-lg font-medium">{row.sanskrit}</div>
            <div className="text-sm text-gray-600 mt-2">{row.english}</div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm">QA Count:</label>
        <select value={qaCount} onChange={e => setQaCount(Number(e.target.value))} className="border px-2 py-1 rounded">
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
        <button className="ml-4 bg-sky-600 text-white px-3 py-1 rounded" onClick={handleGenerate}>Generate</button>
        <button className="ml-2 border px-3 py-1 rounded" onClick={handleSave}>Save</button>
      </div>

      {generated ? (
        <div className="space-y-6">
          {["en","hi","sa"].map(lang => (
            <div key={lang} className="bg-white p-4 rounded shadow-sm">
              <h3 className="font-semibold mb-2">{lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Sanskrit'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium">Questions</h4>
                  <div className="space-y-2 mt-2">
                    {generated[`q_${lang}`].map((q, i) => (
                      <textarea
                        key={i}
                        value={q}
                        onChange={e => updateGenerated(`q_${lang}`, i, e.target.value)}
                        className="w-full border rounded p-2"
                        rows={2}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Answers</h4>
                  <div className="space-y-2 mt-2">
                    {generated[`a_${lang}`].map((a, i) => (
                      <textarea
                        key={i}
                        value={a}
                        onChange={e => updateGenerated(`a_${lang}`, i, e.target.value)}
                        className="w-full border rounded p-2"
                        rows={2}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500">No generated Q&A yet. Click Generate.</div>
      )}
    </div>
  );
}
