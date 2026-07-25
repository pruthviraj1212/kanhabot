"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User as UserIcon, Heart, Utensils, Scale, Ruler, ImagePlus, X } from "lucide-react";
import styles from "./page.module.css";

type MealItem = {
  name: string;
  price: number;
  reason: string;
  category?: string;
  quantity?: number;
};

type Message = {
  id: string;
  role: "user" | "model";
  content: string;
  mealRecommendation?: MealItem[];
  imagePreview?: string;
};

type UserProfile = {
  id?: string;
  name?: string;
  height?: number;
  weight?: number;
  age?: number;
  gender?: string;
  healthGoals: string[];
  medicalConditions: string[];
  foodPreferences: string[];
  tastePreferences: string[];
  medicalReportData?: {
    hba1c?: string;
    sugar?: string;
    cholesterol?: string;
    bloodPressure?: string;
    vitaminD?: string;
    iron?: string;
  };
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "model",
      content: "Welcome to Kanha! 🙏 I'm your personal nutrition assistant. Would you like me to create a custom healthy meal just for you, based on your body and health? Or would you like to browse our menu?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    healthGoals: [],
    medicalConditions: [],
    foodPreferences: [],
    tastePreferences: [],
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 4MB for Gemini inline data)
    if (file.size > 4 * 1024 * 1024) {
      alert("Image too large. Please upload an image under 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageData(result);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);

    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearImage = () => {
    setImageData(null);
    setImagePreview(null);
  };

  const handleSend = async () => {
    if (!input.trim() && !imageData) return;

    const userMessage = input.trim();
    setInput("");
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessage || (imageData ? "📷 Uploaded medical report" : ""),
      imagePreview: imagePreview || undefined,
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setIsLoading(true);

    const currentImage = imageData;
    clearImage();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userProfile.id,
          message: userMessage || (currentImage ? "Please read this medical report" : ""),
          image: currentImage || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch response");
      }

      const data = await res.json();
      
      const modelMsg: Message = {
        id: Date.now().toString(),
        role: "model",
        content: data.reply,
        mealRecommendation: data.mealRecommendation?.length > 0 ? data.mealRecommendation : undefined,
      };

      setMessages((prev) => [...prev, modelMsg]);
      
      if (data.user) {
        setUserProfile(data.user);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "model", content: "Sorry, I am having trouble connecting right now. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const totalMealPrice = (items: MealItem[]) => items.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <Utensils size={24} color="var(--primary)" />
          <span>Kanha — AI Nutrition Assistant</span>
        </div>
      </header>

      <main className={styles.main}>
        {/* Sidebar: AI Memory */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <h3>Your Profile</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              I remember everything so you don&apos;t have to repeat.
            </p>
          </div>

          {/* Body Stats */}
          {(userProfile.height || userProfile.weight || userProfile.age) && (
            <div className={styles.sidebarSection}>
              <h3>Body Stats</h3>
              <div className={styles.statsGrid}>
                {userProfile.age && (
                  <div className={styles.statCard}>
                    <span>🎂</span>
                    <span>{userProfile.age} yrs</span>
                  </div>
                )}
                {userProfile.height && (
                  <div className={styles.statCard}>
                    <Ruler size={14} />
                    <span>{userProfile.height} cm</span>
                  </div>
                )}
                {userProfile.weight && (
                  <div className={styles.statCard}>
                    <Scale size={14} />
                    <span>{userProfile.weight} kg</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical Conditions */}
          <div className={styles.sidebarSection}>
            <h3>
              <Heart size={14} style={{ marginRight: "0.4rem", display: "inline" }} />
              Medical Conditions
            </h3>
            <div>
              {userProfile.medicalConditions?.length > 0 ? (
                userProfile.medicalConditions.map((c, i) => <span key={i} className={`${styles.tag} ${styles.tagWarning}`}>{c}</span>)
              ) : (
                <span className={styles.tagEmpty}>None yet</span>
              )}
            </div>
          </div>

          {/* Health Goals */}
          <div className={styles.sidebarSection}>
            <h3>Health Goals</h3>
            <div>
              {userProfile.healthGoals?.length > 0 ? (
                userProfile.healthGoals.map((g, i) => <span key={i} className={`${styles.tag} ${styles.tagSuccess}`}>{g}</span>)
              ) : (
                <span className={styles.tagEmpty}>None yet</span>
              )}
            </div>
          </div>

          {/* Diet & Allergies */}
          <div className={styles.sidebarSection}>
            <h3>Diet & Allergies</h3>
            <div>
              {userProfile.foodPreferences?.length > 0 ? (
                userProfile.foodPreferences.map((g, i) => <span key={i} className={styles.tag}>{g}</span>)
              ) : (
                <span className={styles.tagEmpty}>None yet</span>
              )}
            </div>
          </div>

          {/* Taste */}
          <div className={styles.sidebarSection}>
            <h3>Taste Preferences</h3>
            <div>
              {userProfile.tastePreferences?.length > 0 ? (
                userProfile.tastePreferences.map((g, i) => <span key={i} className={styles.tag}>{g}</span>)
              ) : (
                <span className={styles.tagEmpty}>None yet</span>
              )}
            </div>
          </div>

          {/* Medical Reports */}
          {userProfile.medicalReportData && Object.values(userProfile.medicalReportData).some(v => v) && (
            <div className={styles.sidebarSection}>
              <h3>Medical Reports</h3>
              <div className={styles.reportGrid}>
                {userProfile.medicalReportData.sugar && (
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Sugar</span>
                    <span className={styles.reportValue}>{userProfile.medicalReportData.sugar}</span>
                  </div>
                )}
                {userProfile.medicalReportData.bloodPressure && (
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>BP</span>
                    <span className={styles.reportValue}>{userProfile.medicalReportData.bloodPressure}</span>
                  </div>
                )}
                {userProfile.medicalReportData.hba1c && (
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>HbA1c</span>
                    <span className={styles.reportValue}>{userProfile.medicalReportData.hba1c}</span>
                  </div>
                )}
                {userProfile.medicalReportData.cholesterol && (
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Cholesterol</span>
                    <span className={styles.reportValue}>{userProfile.medicalReportData.cholesterol}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Chat Area */}
        <section className={styles.chatContainer}>
          <div className={styles.messages}>
            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.messageUser : styles.messageModel}`}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", opacity: 0.8, fontSize: "0.8rem" }}>
                  {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                  {msg.role === 'user' ? "You" : "Kanha AI"}
                </div>

                {/* Image preview in message */}
                {msg.imagePreview && (
                  <div className={styles.messageImage}>
                    <img src={msg.imagePreview} alt="Uploaded report" />
                  </div>
                )}

                <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</div>

                {/* Meal Recommendation Cards */}
                {msg.mealRecommendation && msg.mealRecommendation.length > 0 && (
                  <div className={styles.mealCards}>
                    <div className={styles.mealCardsHeader}>
                      <Utensils size={16} />
                      <span>Your Custom Meal</span>
                    </div>
                    {msg.mealRecommendation.map((item, i) => (
                      <div key={i} className={styles.mealCard}>
                        <div className={styles.mealCardTop}>
                          <span className={styles.mealName}>
                            {item.quantity && item.quantity > 1 ? `${item.quantity}x ` : ""}
                            {item.name}
                          </span>
                          <span className={styles.mealPrice}>₹{item.price * (item.quantity || 1)}</span>
                        </div>
                        {item.category && <span className={styles.mealCategory}>{item.category}</span>}
                        <p className={styles.mealReason}>{item.reason}</p>
                      </div>
                    ))}
                    <div className={styles.mealTotal}>
                      <span>Total</span>
                      <span>₹{totalMealPrice(msg.mealRecommendation)}</span>
                    </div>
                  </div>
                )}

                <div className={styles.messageTime}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className={`${styles.messageWrapper} ${styles.messageModel}`}>
                <div className={styles.typingIndicator}>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview Bar */}
          {imagePreview && (
            <div className={styles.imagePreviewBar}>
              <div className={styles.imagePreviewThumb}>
                <img src={imagePreview} alt="Preview" />
                <button className={styles.imageRemoveBtn} onClick={clearImage}>
                  <X size={14} />
                </button>
              </div>
              <span className={styles.imagePreviewText}>📷 Medical report attached</span>
            </div>
          )}

          <div className={styles.inputArea}>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageSelect}
            />
            <button
              className={styles.imageUploadBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Upload medical report photo"
            >
              <ImagePlus size={22} />
            </button>
            <input
              type="text"
              className={styles.input}
              placeholder="Tell me about your health or what you'd like to eat..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={isLoading}
            />
            <button 
              className={styles.sendButton} 
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !imageData)}
            >
              <Send size={20} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
