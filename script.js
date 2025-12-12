const GEMINI_API_KEY = 'AIzaSyDJz6-OLwZohEnd9Ty5fmj9eEVe42ed8-g';
const SHEET_NAME = 'ArtefactAnalyses';
const FOLDER_NAME = 'ArtefactImages';

/** Serve HTML */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('🪶 Archaeologist AI Artefact Analyzer');
}

/** POST endpoint */
function doPost(e){
  try{
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = body.action || '';
    const userEmail = body.email;
    if(!userEmail) return jsonError('Missing user email',401);

    if(action==='analyze'){
      const aiText = analyzeArtifact(body.form||{}, body.base64Image||null, userEmail);
      return ContentService.createTextOutput(JSON.stringify({aiText})).setMimeType(ContentService.MimeType.JSON);
    } else if(action==='getAnalyses'){
      const analyses = getUserAnalyses(userEmail).map(item=>({
        timestamp:item.timestamp,
        location:item.details.location||'',
        size:item.details.size||'',
        material:item.details.material||'',
        markings:item.details.markings||'',
        age:item.details.age||'',
        context:item.details.context||'',
        notes:item.details.notes||'',
        imageUrl:item.image,
        analysis:item.analysis
      }));
      return ContentService.createTextOutput(JSON.stringify({analyses})).setMimeType(ContentService.MimeType.JSON);
    } else{
      return jsonError('Unknown action',400);
    }
  } catch(err){
    return jsonError(err.message||String(err),500);
  }
}

/** Analyze artefact */
function analyzeArtifact(form, base64Image, userEmail){
  const prompt = `
You are an expert archaeologist AI.

Analyze BOTH:
1. The image of the artefact
2. The structured details

Provide:
- Possible purpose or origin  
- Probable age or era  
- Cultural/historical context  
- Similar artefacts  
- Material interpretation  
- Condition state  
- Any iconography decoded  

🧾 Sources Used (credible sources only, no Wikipedia)

🪶 DETAILS:
Location: ${form.location}
Size: ${form.size}
Material: ${form.material}
Markings: ${form.markings}
Age: ${form.age}
Context: ${form.context}
Notes: ${form.notes}
`;

  const aiText = callGemini(prompt, base64Image);
  saveAnalysis(form, base64Image, aiText, userEmail);
  return aiText;
}

/** Call Gemini API */
function callGemini(prompt, base64Image){
  const url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";
  const payload={
    contents:[{
      parts:[
        {text:prompt},
        base64Image? {inline_data:{mime_type:"image/jpeg",data:base64Image}} : {}
      ]
    }]
  };
  const res = UrlFetchApp.fetch(url,{
    method:"post",
    contentType:"application/json",
    headers:{"x-goog-api-key":GEMINI_API_KEY},
    payload:JSON.stringify(payload),
    muteHttpExceptions:true
  });
  const data = JSON.parse(res.getContentText());
  if(data.error) throw new Error(JSON.stringify(data.error,null,2));
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No response received.";
}

/** Save analysis to Sheet + Drive */
function saveAnalysis(formData, base64Image, aiText, userEmail){
  const sheet = getOrCreateSheet(SHEET_NAME);
  let imageUrl='';
  if(base64Image){
    const folder = getOrCreateFolder(FOLDER_NAME);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Image),'image/jpeg','artefact.jpg');
    const file = folder.createFile(blob);
    imageUrl=file.getUrl();
  }
  sheet.appendRow([userEmail,new Date(),JSON.stringify(formData),imageUrl,aiText]);
}

/** Get past analyses */
function getUserAnalyses(userEmail){
  const sheet = getOrCreateSheet(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const userRows = rows.filter((r,i)=>i>0 && r[0]===userEmail);
  return userRows.map(r=>({timestamp:r[1],details:JSON.parse(r[2]),image:r[3],analysis:r[4]}));
}

/** Helpers */
function getOrCreateSheet(name){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=ss.getSheetByName(name);
  if(!sheet) sheet=ss.insertSheet(name);
  if(sheet.getLastRow()===0) sheet.appendRow(['Email','Timestamp','ArtefactDetails','ImageURL','AIAnalysis']);
  return sheet;
}

function getOrCreateFolder(name){
  const folders=DriveApp.getFoldersByName(name);
  if(folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function jsonError(msg,code){
  code=code||400;
  const output={error:msg||'error'};
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
}
