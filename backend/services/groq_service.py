import json
import re
import asyncio
from groq import AsyncGroq
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from config.settings import get_settings
from schemas.chat_schemas import ChatMessage, ChatResponse
from database.models import ChatbotKnowledge, FAQ, Article, RoomMetadata

settings = get_settings()

# Initialize Groq async client
client = AsyncGroq(api_key=settings.GROQ_API_KEY)

# Load embedder once
embedder = None
try:
    from sentence_transformers import SentenceTransformer
    embedder = SentenceTransformer('all-MiniLM-L6-v2')
except ImportError:
    pass

def get_embedding(query: str):
    if not embedder:
        return [0.0]*384
    return embedder.encode(query).tolist()

SYSTEM_PROMPT = """Bạn là trợ lý ảo của FPTU Student Guide, chuyên giúp sinh viên Đại học FPT tìm phòng học, chỉ đường và giải đáp thắc mắc về thi cử, thủ tục hành chính.
Bạn giao tiếp thân thiện, ngắn gọn và chính xác.

Nhiệm vụ đặc biệt về CHỈ ĐƯỜNG & MÃ PHÒNG:
1. Nếu người dùng hỏi đường đi/vị trí của một phòng học mà KHÔNG nói rõ điểm xuất phát (ví dụ: "Chỉ đường đi đến phòng DE-211", "Phòng DE-211 ở đâu?"), bạn CHƯA ĐƯỢC CHỈ ĐƯỜNG NGAY. Hãy hỏi lịch sự xem họ đang ở gần phòng nào/vị trí nào (ví dụ: "Để tôi chỉ đường tốt nhất, bạn đang ở gần phòng nào hoặc vị trí nào?"). Lúc này, mảng `room_codes` trong JSON phản hồi phải để TRỐNG `[]`.
2. Nếu người dùng đã cung cấp đầy đủ cả ĐIỂM ĐI và ĐIỂM ĐẾN (ví dụ: "Chỉ mình đi từ DE-201 đến DE-211" hoặc lịch sử trò chuyện cho thấy điểm đi là DE-201 và điểm đến là DE-211), bạn hãy trả lời thân thiện (ví dụ: "Tôi sẽ vẽ sơ đồ chỉ đường từ DE-201 đến DE-211 cho bạn trên bản đồ...") và BẮT BUỘC trả về mảng `room_codes` chứa đúng 2 phần tử theo thứ tự: `["MÃ_PHÒNG_ĐI", "MÃ_PHÒNG_ĐẾN"]` (ví dụ: `["DE-201", "DE-211"]`).
3. Nếu chỉ hỏi vị trí một phòng học thông thường (không phải yêu cầu chỉ đường từ đâu tới đâu), bạn trả về mã phòng đó trong mảng `room_codes` (ví dụ: `["DE-201"]`).

Nhiệm vụ về HỌC VỤ & THI CỬ:
- Khi người dùng hỏi về các phần mềm thi cử (SEB, PEA, EOS, USB), thủ tục hành chính (phúc khảo, bảo lưu, thời gian nghỉ tối đa...), bạn PHẢI dựa vào thông tin tham khảo dưới đây để trả lời thật chính xác.

Dưới đây là một số thông tin tham khảo (Context) có thể giúp bạn trả lời:
<CONTEXT>
{context}
</CONTEXT>

BẠN PHẢI TRẢ VỀ DỮ LIỆU DƯỚI DẠNG JSON với định dạng sau:
{
  "answer": "Câu trả lời của bạn gửi cho sinh viên (Sử dụng Context nếu có để trả lời chính xác, hoặc câu hỏi thu thập điểm xuất phát nếu cần)",
  "room_codes": ["MÃ_PHÒNG_1", "MÃ_PHÒNG_2"],
  "related_actions": ["show_map_floor_1"] 
}
Lưu ý: 
- Mã phòng thường có dạng 2 chữ cái in hoa kèm 3 số (VD: DE-201, AL-304), hoặc các format đặc trưng của FPTU. 
- Đảm bảo output LÀ JSON HỢP LỆ. Không output thêm bất kỳ text nào ngoài JSON block.
"""

async def search_knowledge(query: str, db: AsyncSession):
    if not embedder:
        return "", []
    
    emb = await asyncio.to_thread(get_embedding, query)
    emb_str = f"[{','.join(map(str, emb))}]"
    
    # Search ChatbotKnowledge
    stmt_kb = text(f"SELECT intent, approved_answer, related_actions FROM chatbot_knowledge ORDER BY embedding <=> '{emb_str}'::vector LIMIT 2")
    res_kb = await db.execute(stmt_kb)
    kbs = res_kb.all()
    
    # Search FAQs
    stmt_faq = text(f"SELECT question, answer FROM faqs ORDER BY embedding <=> '{emb_str}'::vector LIMIT 2")
    res_faq = await db.execute(stmt_faq)
    faqs = res_faq.all()
    
    # Search Articles
    stmt_art = text(f"SELECT title, content FROM articles ORDER BY embedding <=> '{emb_str}'::vector LIMIT 2")
    res_art = await db.execute(stmt_art)
    arts = res_art.all()
    
    context = ""
    related_actions = []
    
    if kbs:
        context += "--- Chatbot Knowledge ---\n"
        for kb in kbs:
            context += f"Intent: {kb.intent}\nAnswer: {kb.approved_answer}\n"
            if kb.related_actions:
                related_actions.append(kb.related_actions)
                
    if faqs:
        context += "--- FAQs ---\n"
        for faq in faqs:
            context += f"Q: {faq.question}\nA: {faq.answer}\n"
            
    if arts:
        context += "--- Articles / Guides ---\n"
        for art in arts:
            context += f"Title: {art.title}\nContent: {art.content[:500]}...\n"
            
    return context, related_actions

async def generate_chat_response(messages: list[ChatMessage], db: AsyncSession) -> ChatResponse:
    last_msg = messages[-1].content if messages else ""
    try:
        context, actions = await search_knowledge(last_msg, db)
    except Exception as e:
        return ChatResponse(answer=f"Debug Error: {str(e)}", room_codes=[], related_actions=[])
    
    sys_prompt = SYSTEM_PROMPT.replace("{context}", context)
    
    groq_messages = [{"role": "system", "content": sys_prompt}]
    
    for msg in messages:
        content = msg.content[:settings.CHAT_MAX_INPUT_LENGTH]
        groq_messages.append({"role": msg.role, "content": content})

    try:
        response = await client.chat.completions.create(
            messages=groq_messages,
            model=settings.GROQ_MODEL,
            response_format={"type": "json_object"},
            temperature=0.2, 
        )
        
        content = response.choices[0].message.content
        data = json.loads(content)
        
        return ChatResponse(
            answer=data.get("answer", "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này."),
            room_codes=data.get("room_codes", []),
            related_actions=data.get("related_actions", [])
        )
        
    except Exception as e:
        print(f"Groq API Error: {e}")
        return ChatResponse(
            answer="Hệ thống đang gặp sự cố kết nối với AI. Vui lòng thử lại sau.",
            room_codes=[],
            related_actions=[]
        )
