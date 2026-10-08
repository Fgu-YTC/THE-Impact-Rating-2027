# -*- coding: utf-8 -*-
"""Convert Impact Rating Excel to bilingual EN(left) / ZH(right) question format."""
import re
from copy import copy
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

SRC = r"E:\奕廷\永續辦業務\大學排名\THE\2027\Impact Rating 2027\Impact 2027-data collection support v1.xlsx"
OUT = r"E:\奕廷\永續辦業務\大學排名\THE\2027\Impact Rating 2027\Impact 2027-data collection support v1_雙語提問.xlsx"

# Exact-match translations (key = cleaned English text)
TR = {
    # common options
    "free": "免費",
    "Free": "免費",
    "paid": "付費",
    "Paid": "付費",
    "subsidised": "補助／優惠",
    "directly": "直接",
    "indirectly": "間接",
    "local": "地方",
    "regional": "區域",
    "national": "國家",
    "global": "全球",
    "Local": "地方",
    "Regional": "區域",
    "National": "國家",
    "Global": "全球",
    "whole university": "全校",
    "Whole university": "全校",
    "partial measurement": "部分量測",
    "Partial measurement": "部分量測",
    "all food outlets": "所有餐飲據點",
    "selected food outlets": "部分餐飲據點",
    "local collaboration": "地方合作",
    "national collaboration": "國家合作",
    "global cooperation": "全球合作",
    "Local communities": "地方社區",
    "Disadvantaged people": "弱勢族群",
    "Refugee/immigrant communities": "難民／移民社區",
    "Free access to all facilities": "所有設施免費開放",
    "Free access to some facilities": "部分設施免費開放",
    "Charged access": "付費使用",
    "Free access": "免費使用",
    "Active promotion of good mental health": "積極推廣心理健康",
    "Access to (or signposting to) free mental health support": "提供（或轉介）免費心理健康支持",
    "Access to (or signposting to) charged mental health support": "提供（或轉介）付費心理健康支持",
    "Smoking-free campus": "無菸校園",
    "Smoking in designated areas": "僅限指定區域吸菸",
    "Free courses leading to certificate or award": "可取得證書或獎項之免費課程",
    "Free access to campus facilities and equipment": "免費使用校園設施與設備",
    "Free access to online resources": "免費使用線上資源",
    "Free events": "免費活動",
    "Both changed and free": "付費與免費皆有",
    "Ad hoc": "臨時／不定期",
    "On programmed basis": "有計畫／定期辦理",
    "Mentoring": "輔導／Mentoring",
    "Scholarship": "獎學金",
    "Other provision": "其他措施",
    "through university outreach": "透過大學外展",
    "through collaboration with other universities and/or community groups and/or government     and/or NGOs in regional or national campaigns": "透過與其他大學、社區團體、政府及／或 NGO 之區域或全國性合作宣導",
    "Other targeted support": "其他針對性支持",
    "Free access to all significant buildings": "所有重要建築免費開放",
    "Some free access": "部分免費開放",
    "Paid access": "付費開放",
    "Automatic free access": "自動免費開放",
    "Access to all after application": "申請後全面開放",
    "Access in some circumstances": "特定情況下開放",
    "Free access to all museums and galleries": "所有博物館與藝廊免費開放",
    "Free access to some": "部分免費開放",
    "Permanent free access": "永久免費開放",
    "Occasional free access": "偶爾免費開放",
    "More than 30 perfomancees": "每年超過 30 場演出",
    "More than 15 perfomances": "每年超過 15 場演出",
    "Ad-hoc only": "僅臨時辦理",
    "Local or regional cultural heritage": "地方或區域文化遺產",
    "National cultural heritage": "國家文化遺產",
    "Heritage of displaced communities": "流離失所社區之文化遺產",
    "Evaluating affordability": "評估可負擔性",
    "Providing housing directly": "直接提供住房",
    "Providing financial support": "提供財務支持",
    "Annual": "每年",
    "Bi-annual": "每兩年",
    "Less Frequent": "較不頻繁",
    "scope 1": "範疇 1",
    "scope 1 and 2": "範疇 1 與 2",
    "Scope 1, 2 and 3 (partial)": "範疇 1、2 與 3（部分）",
    "Scope 1, 2 and 3 (full)": "範疇 1、2 與 3（完整）",
    "Achieve by date": "達成日期",
    "On-going": "持續進行",
    "students (both undergraduate and graduate)": "學生（大學部與研究所）",
    "faculty": "教職員（faculty）",
    "staff (non-faculty employees)": "職員（非 faculty）",
    "Union provides governance input to university": "學生會參與大學治理",
    "Union provides support for students": "學生會提供學生支持",
    "Union provides social activities": "學生會辦理社交活動",
    "Research freedom for senior academics": "資深教師研究自由",
    "Research freedom for junior academics": "初階教師研究自由",
    "Teaching freedom for senior academics": "資深教師教學自由",
    "Teaching freedom for junior academics": "初階教師教學自由",
    "student volunteering programmes": "學生志工計畫",
    "research programmes": "研究計畫",
    "development of educational resources": "發展教育資源",
    "overall report": "整體報告",
    "separate report": "獨立報告",
    "education integrated across full curriculum": "融入整體課程",
    "mandatory education for all": "全體必修",
    "optional education for all": "全體選修／可選",
    "Alumni": "校友",
    "Local community": "地方社區",
    "Displaced people and refugees": "流離失所者與難民",
    "Number of students": "學生人數",
    "Number of low income students receiving financial aid": "獲得財務援助之低收入學生人數",
    "Number of graduates": "畢業生人數",
    "Number of graduates in health professions": "健康專業領域畢業生人數",
    "Total food waste": "食物浪費總量",
    "Campus population": "校園人口數",
    "Number of graduates from agriculture and aquaculture courses including sustainability aspects": "含永續面向之農業與水產養殖課程畢業生人數",
    "Number of graduates who gained a qualification that entitled them to teach at primary school level": "取得可於小學任教資格之畢業生人數",
    "Number of students starting a degree": "開始修讀學位之學生人數",
    "Number of first-generation students starting a degree": "開始修讀學位之第一代大學生人數",
    "Number of women starting a degree": "開始修讀學位之女性人數",
    "Number of first-generation women starting a degree": "開始修讀學位之第一代女性大學生人數",
    "Number of senior academic staff": "資深學術人員人數",
    "Number of female senior academic staff": "女性資深學術人員人數",
    "Number of graduates: Total": "畢業生人數：合計",
    "Number of graduates by subject area (STEM, Medicine, Arts & Humanities / Social Sciences): Total": "依學科領域畢業生人數（STEM、醫學、藝術人文／社會科學）：合計",
    "Number of graduates: STEM": "畢業生人數：STEM",
    "Number of graduates: Medicine": "畢業生人數：醫學",
    "Number of graduates: Arts & Humanities / Social Sciences": "畢業生人數：藝術人文／社會科學",
    "Number of female graduates by subject area (STEM, Medicine, Arts & Humanities / Social Sciences): Total": "依學科領域女性畢業生人數（STEM、醫學、藝術人文／社會科學）：合計",
    "Number of female graduates: STEM": "女性畢業生人數：STEM",
    "Number of female graduates: Medicine": "女性畢業生人數：醫學",
    "Number of female graduates: Arts & Humanities / Social Sciences": "女性畢業生人數：藝術人文／社會科學",
    "Volume of water used in the university: Inbound (treated/extracted water)": "大學用水量：進水量（處理／抽取水）",
    "Total energy used": "能源使用總量",
    "University floor space": "大學樓地板面積",
    "Total energy used from low-carbon sources": "低碳能源使用總量",
    "Number of employees": "員工人數",
    "University expenditure": "大學支出",
    "Number of students with work placements for more than a month": "實習超過一個月之學生人數",
    "Number of employees on contracts of over 24 months": "合約超過 24 個月之員工人數",
    "Number of university spin offs": "大學衍生企業數量",
    "Number of university spin-offs": "大學衍生企業數量",
    "Research income from industry and commerce by subject area: STEM": "產業與商業研究收入（依領域）：STEM",
    "Research income from industry and commerce by subject area: Medicine": "產業與商業研究收入（依領域）：醫學",
    "Research income from industry and commerce by subject area: Arts & Humanities / Social sciences": "產業與商業研究收入（依領域）：藝術人文／社會科學",
    "Number of academic staff by subject area: STEM": "學術人員人數（依領域）：STEM",
    "Number of academic staff by subject area: Medicine": "學術人員人數（依領域）：醫學",
    "Number of academic staff by subject area: Arts & Humanities / Social sciences": "學術人員人數（依領域）：藝術人文／社會科學",
    "Number of international students from developing countries": "來自開發中國家之國際學生人數",
    "Number of students with disability": "身心障礙學生人數",
    "Number of employees with disability": "身心障礙員工人數",
    "University expenditure on arts and heritage": "藝術與遺產相關支出",
    "Amount of waste generated": "廢棄物產生量",
    "Amount of waste recycled": "廢棄物回收量",
    "Amount of waste sent to landfill": "送往掩埋之廢棄物量",
    "Number of graduates from law and enforcement related courses": "法律與執法相關課程畢業生人數",
    # metrics / short titles
    "Proportion of students receiving financial aid to attend university because of poverty": "因貧困而獲得助學財務援助之學生比例",
    "Low income students receiving financial aid": "獲得財務援助之低收入學生",
    "University anti-poverty programmes": "大學反貧窮計畫",
    "Community anti-poverty programmes": "社區反貧窮計畫",
    "Campus food waste": "校園食物浪費",
    "Student hunger": "學生飢餓問題",
    "Proportion of graduates in agriculture and aquaculture including sustainability aspects": "含永續面向之農業與水產養殖畢業生比例",
    "Proportion of graduates in agriculture and aquaculture": "農業與水產養殖畢業生比例",
    "National hunger": "國家層級飢餓議題",
    "Number graduating in health professions": "健康專業領域畢業生人數",
    "Proportion of graduates in health professions": "健康專業領域畢業生比例",
    "Collaborations and health services": "合作與健康服務",
    "Proportion of graduates with teaching qualification": "具教學資格之畢業生比例",
    "Proportion of graduates with relevant qualification for teaching": "具相關教學資格之畢業生比例",
    "Lifelong learning measures": "終身學習措施",
    "Proportion of first-generation students": "第一代大學生比例",
    "Proportion of first-generation female students": "第一代女性大學生比例",
    "Proportion of women first-generation": "第一代女性比例",
    "Student access measures": "學生入學近用措施",
    "Proportion of senior female academics": "女性資深學術人員比例",
    "Proportion of women receiving degrees": "獲得學位之女性比例",
    "Proportion of female degrees awarded": "女性獲頒學位比例",
    "Women's progress measures": "女性發展措施",
    "Water consumption per person": "人均用水量",
    "Water usage and care": "用水與水資源照護",
    "Water reuse": "水資源再利用",
    "Water in the community": "社區水資源",
    "University measures towards affordable and clean energy": "大學推動可負擔潔淨能源之措施",
    "Energy use density": "能源使用密度",
    "Energy usage per sqm": "每平方公尺能源使用量",
    "Energy and the community": "能源與社區",
    "Low-carbon energy use": "低碳能源使用",
    "Low-carbon energy tracking\nMeasure the amount of low carbon energy used across the university": "低碳能源追蹤\n貴校是否量測全校低碳能源使用量？",
    "Employment practice": "就業實務",
    "Expenditure per employee": "每位員工支出",
    "Proportion of students taking work placements": "參與實習之學生比例",
    "Proportion of students with work placements": "有實習經驗之學生比例",
    "Proportion of employees on secure contracts": "具穩定合約之員工比例",
    "University spin offs": "大學衍生企業",
    "Research income from industry and commerce": "產業與商業研究收入",
    "Research income from industry and commerce per academic staff": "每位學術人員之產業與商業研究收入",
    "First-generation students": "第一代大學生",
    "International students from developing countries": "來自開發中國家之國際學生",
    "Proportion of international students from developing countries": "來自開發中國家之國際學生比例",
    "Proportion of students with disabilities": "身心障礙學生比例",
    "Proportion of employees with disabilities": "身心障礙員工比例",
    "Measures against discrimination": "反歧視措施",
    "Support of arts and heritage": "藝術與遺產支持",
    "Expenditure on arts and heritage": "藝術與遺產支出",
    "Arts and heritage expenditure": "藝術與遺產支出",
    "Sustainable practices": "永續實務",
    "Operational measures": "營運措施",
    "Proportion of recycled waste": "廢棄物回收比例",
    "Proportion of waste recycled": "廢棄物回收比例",
    "Publication of a sustainability report": "發布永續報告",
    "Low-carbon energy tracking": "低碳能源追蹤",
    "Low carbon energy tracking": "低碳能源追蹤",
    "Environmental education measures": "環境教育措施",
    "Commitment to carbon neutral university": "碳中和大學承諾",
    "Supporting aquatic ecosystems through education": "透過教育支持水生生態系",
    "Supporting aquatic ecosystems through action": "透過行動支持水生生態系",
    "Water sensitive waste disposal": "顧及水資源之廢棄物處理",
    "Maintaining a local ecosystem": "維護地方生態系",
    "Supporting land ecosystems through education": "透過教育支持陸域生態系",
    "Supporting land ecosystems through action": "透過行動支持陸域生態系",
    "Land sensitive waste disposal": "顧及土地之廢棄物處理",
    "University governance measures": "大學治理措施",
    "Working with government": "與政府合作",
    "Proportion of graduates in law and civil enforcement": "法律與公民執法畢業生比例",
    "Proportion of graduates in law": "法律畢業生比例",
    "Relationships to support the goals": "支持永續目標之夥伴關係",
    "Publication of SDG reports": "發布 SDG 報告",
    "Education for the SDGs": "SDG 教育",
}

# Multi-line indicator translations: title\nbody -> zh title\nzh question-style body
# Keys use normalized whitespace
INDICATORS = {
    "Bottom financial quintile admission target\nTargets to admit students who fall into the bottom 20% of household income group (or a more tightly defined target) in the country.":
    "最低所得五分位入學目標\n貴校是否訂有招收國內最低所得 20% 家庭學生（或更嚴格定義目標）之目標？",

    "Bottom financial quintile student success\nGraduation/completion targets for students who fall into the bottom 20% of household income group (or a more tightly defined target) in the country.":
    "最低所得五分位學生成功\n貴校是否訂有國內最低所得 20% 家庭學生（或更嚴格定義目標）之畢業／完成學業目標？",

    "Low-income student support\nProvide support (e.g. food, housing, transportation, legal services) for students from low income families to enable them to complete university.":
    "低收入學生支持\n貴校是否提供低收入家庭學生支持（如食物、住宿、交通、法律服務），以協助其完成大學學業？",

    "Bottom financial quintile student support\nProgrammes or initiatives to assist students who fall into the bottom 20% of household income group (or a more tightly defined target) in the country to successfully complete their studies.":
    "最低所得五分位學生支持\n貴校是否有計畫或措施，協助國內最低所得 20% 家庭學生（或更嚴格定義目標）順利完成學業？",

    "Low or lower-middle income countries student support\nSchemes to support poor students from low or lower-middle income countries (e.g. offering free education, grants).":
    "低度／中低所得國家學生支持\n貴校是否有方案支持來自低度或中低所得國家之清寒學生（如免費教育、獎助金）？",

    "Local start-up assistance\nProvide assistance in the local community supporting the start-up of financially and socially  sustainable businesses through relevant education or resources (e.g. mentorship programmes, training workshops, access to university facilities).":
    "地方新創協助\n貴校是否透過相關教育或資源（如 mentorship、培訓工作坊、開放大學設施），協助地方社區創立財務與社會上可持續之事業？",

    "Local start-up assistance\nProvide assistance in the local community supporting the start-up of sustainable businesses through relevant education or resources (e.g. mentorship programmes, training workshops, access to university facilities).":
    "地方新創協助\n貴校是否透過相關教育或資源（如 mentorship、培訓工作坊、開放大學設施），協助地方社區創立永續事業？",

    "Local start-up financial assistance\nProvide financial assistance to the local community supporting the start-up of financially and socially sustainable businesses.":
    "地方新創財務協助\n貴校是否提供地方社區財務協助，支持創立財務與社會上可持續之事業？",

    "Local start-up financial assistance\nProvide financial assistance to the local community supporting the start-up of sustainable businesses.":
    "地方新創財務協助\n貴校是否提供地方社區財務協助，支持創立永續事業？",

    "Programmes for services access\nOrganise training or programmes to improve access to basic services for all.":
    "基本服務近用計畫\n貴校是否辦理培訓或計畫，以改善全民取得基本服務之近用？",

    "Policy addressing poverty\nParticipate in policy making at local, regional, national and/or global level to implement programmes and policies to end poverty in all its dimensions.":
    "因應貧窮之政策參與\n貴校是否參與地方、區域、國家及／或全球層級之政策制定，以推動終結各面向貧窮之計畫與政策？",

    "Campus food waste tracking\nMeasure the amount of food waste generated from food served within the university.":
    "校園食物浪費追蹤\n貴校是否量測校內供餐所產生之食物浪費量？",

    "Student food insecurity and hunger\nHave a programme in place on student food insecurity.":
    "學生糧食不安全與飢餓\n貴校是否已有因應學生糧食不安全之計畫？",

    "Students hunger interventions\nProvide interventions to prevent or alleviate hunger among students (e.g. including supply and access to food banks/pantries).":
    "學生飢餓介入措施\n貴校是否提供介入措施以預防或減輕學生飢餓（例如食物銀行／食物儲備之供應與近用）？",

    "Sustainable food choices on campus\nProvide sustainable food choices for all on campus, including vegetarian and vegan food.":
    "校園永續飲食選擇\n貴校是否為校園所有人提供永續飲食選擇，包括素食與純素？",

    "Healthy and affordable food choices\nProvide healthy and affordable food choices for all on campus.":
    "健康且可負擔之飲食選擇\n貴校是否為校園所有人提供健康且可負擔之飲食選擇？",

    "Staff hunger interventions\nProvide interventions to prevent or alleviate hunger among members of staff (e.g. including supply and access to food banks/pantries).":
    "教職員飢餓介入措施\n貴校是否提供介入措施以預防或減輕教職員飢餓（例如食物銀行／食物儲備之供應與近用）？",

    "Access to food security knowledge\nProvide access on food security and sustainable agriculture and aquaculture knowledge, skills or technology to local farmers and food producers.":
    "糧食安全知識近用\n貴校是否向地方農民與食品生產者提供糧食安全及永續農漁養殖之知識、技能或技術近用？",

    "Events for local farmers and food producers\nProvide events for local farmers and food producers to connect and transfer knowledge":
    "地方農民與食品生產者活動\n貴校是否辦理活動，供地方農民與食品生產者交流並移轉知識？",

    "University access to local farmers and food producers\nProvide access to university facilities (e.g. labs, technology, plant stocks) to local farmers and food producers to improve sustainable farming practices.":
    "大學設施開放予地方農民與食品生產者\n貴校是否開放大學設施（如實驗室、技術、種苗）予地方農民與食品生產者，以改善永續農業實務？",

    "Sustainable food purchases\nPrioritise purchase of products from local, sustainable sources.":
    "永續食品採購\n貴校是否優先採購來自地方、永續來源之產品？",

    "Current collaborations with health institutions\nHave current collaborations with local, national, or global health institutions to improve health and well-being outcomes.":
    "與健康機構之現行合作\n貴校是否與地方、國家或全球健康機構有現行合作，以改善健康與福祉成果？",

    "Health outreach programmes\nDeliver outreach programmes and projects in the local community (which can include student volunteering programmes) to improve or promote health and well-being including hygiene, nutrition, family planning, sports, exercise, aging well, and other health and well-being related topics.\nThis can also include outreach programmes to displaced or refugee communities local to the institution.":
    "健康外展計畫\n貴校是否在地方社區辦理外展計畫與專案（可含學生志工），以改善或推廣健康與福祉（含衛生、營養、家庭計畫、運動、健身、健康老化等）？亦可包含對機構所在地流離失所或難民社區之外展。",

    "Shared sports facilities\nShare sports facilities with the local community, for instance with local schools or with the general public.":
    "共享運動設施\n貴校是否與地方社區共享運動設施（例如地方學校或一般大眾）？",

    "Sexual and reproductive health care services for students\nProvide students access to sexual and reproductive health-care services including information and education services.":
    "學生性與生殖健康照護服務\n貴校是否提供學生性與生殖健康照護服務近用（含資訊與教育服務）？",

    "Mental health support for students\nProvide students with access to mental health support.":
    "學生心理健康支持\n貴校是否提供學生心理健康支持之近用？",

    "Smoke-free policy\nHave a \"smoke-free\" policy.":
    "無菸政策\n貴校是否訂有「無菸」政策？",

    "Smoke-free policy\nHave a 'smoke-free' policy.":
    "無菸政策\n貴校是否訂有「無菸」政策？",

    "Mental health support for staff\nProvide staff  with access to mental health support.":
    "教職員心理健康支持\n貴校是否提供教職員心理健康支持之近用？",

    "Public resources (lifelong learning)\nProvide free access to educational resources for those not studying at the university.":
    "公共資源（終身學習）\n貴校是否為非在校就讀者提供免費教育資源近用？",

    "Public events (lifelong learning)\nHost educational events at university that are open to the general public.":
    "公開活動（終身學習）\n貴校是否在校內舉辦對一般大眾開放之教育活動？",

    "Vocational training events (lifelong learning)\nHost events at university that are open to the general public: executive education programmes (this refers to short courses for people who are not attending the university; this specifically excludes courses like MBA) and/or vocational training.":
    "職業訓練活動（終身學習）\n貴校是否舉辦對一般大眾開放之活動：高階主管教育（指非在校生之短期課程，不含 MBA 等）及／或職業訓練？",

    "Education outreach activities beyond campus\nUndertake educational outreach activities (e.g. tailored lectures or demonstrations) beyond campus – in local schools, in the community. This can include voluntary student-run schemes.":
    "校園外教育外展活動\n貴校是否在校園外（地方學校、社區）辦理教育外展活動（如客製講座或示範）？可含學生志工方案。",

    "Lifelong learning access policy\nA policy that ensures that access to these activities is accessible to all, regardless of ethnicity, religion, disability immigration status or gender.":
    "終身學習近用政策\n貴校是否訂有政策，確保上述活動近用不受族群、宗教、身心障礙、移民身分或性別影響？",

    "Tracking access measures\nSystematically measure and track women's application rate, acceptance or entry rate.":
    "近用追蹤措施\n貴校是否系統性量測並追蹤女性申請率、錄取率或入學率？",

    "Policy for women applications and entry\nHave a policy (e.g. an Access and Participation plan) addressing women's applications, acceptance, entry, and participation at the university.":
    "女性申請與入學政策\n貴校是否訂有政策（如近用與參與計畫），處理女性申請、錄取、入學與參與？",

    "Women's access schemes\nProvide women's access schemes, including mentoring, scholarships, or other provision":
    "女性近用方案\n貴校是否提供女性近用方案（含 mentorship、獎學金或其他措施）？",

    "Women's application in underrepresented subjects\nEncourage applications by women in subjects where they are underrepresented. Through university outreach or through collaboration with other universities, community groups, government or NGOs in regional or national campaigns.":
    "女性於代表性不足學科之申請\n貴校是否鼓勵女性申請其代表性不足之學科？可透過大學外展，或與其他大學、社區團體、政府或 NGO 之區域／全國宣導合作。",

    "Policy of non-discrimination against women\nHave a policy of non-discrimination against women":
    "禁止歧視女性政策\n貴校是否訂有禁止歧視女性之政策？",

    "Non-discrimination policies for transgender\nHave a policy of non-discrimination for transgender people.":
    "跨性別不歧視政策\n貴校是否訂有對跨性別者不歧視之政策？",

    "Maternity policy\nHave a maternity policy that support women's participation.":
    "產假／孕產政策\n貴校是否訂有支持女性參與之孕產相關政策？",

    "Maternity policy\nHave a maternity policy that supports women's participation.":
    "產假／孕產政策\n貴校是否訂有支持女性參與之孕產相關政策？",

    "Childcare facilities for students\nHave accessible childcare facilities for students which allow recent mothers to attend university courses.":
    "學生托育設施\n貴校是否提供學生可近用之托育設施，使甫生產之母親能修課？",

    "Childcare facilities for students\nHave accessible childcare facilities for students which allow recent mothers to attend university\ncourses.":
    "學生托育設施\n貴校是否提供學生可近用之托育設施，使甫生產之母親能修課？",

    "Childcare facilities for staff and faculty\nHave childcare facilities for staff and faculty":
    "教職員托育設施\n貴校是否為教職員提供托育設施？",

    "Women's mentoring schemes\nHave women's mentoring schemes, in which at least 10% of female students participate.":
    "女性 mentorship 方案\n貴校是否有女性 mentorship 方案，且至少 10% 女性學生參與？",

    "Track women's graduation rate\nHave measurement or tracking of women's likelihood of graduating compared to men's, and schemes in place to close any gap.":
    "追蹤女性畢業率\n貴校是否量測／追蹤女性相對男性之畢業可能性，並有縮小差距之方案？",

    "Policies protecting those reporting discrimination\nHave a policy that protects those reporting discrimination from educational or employment disadvantage":
    "保護檢舉歧視者之政策\n貴校是否訂有政策，保護檢舉歧視者不致遭受教育或就業不利？",

    "Paternity policy\nHave a paternity policy that supports women's participation by ensuring that fathers can participate in childcare duties":
    "陪產／育嬰假政策\n貴校是否訂有陪產／育嬰相關政策，確保父親可參與育兒以支持女性參與？",

    "Measure the total volume of water used in the university that is taken from mains supply,\ndesalinated, or extracted from rivers, lakes, or aquifers?":
    "貴校是否量測自來水、淡化水，或自河川、湖泊、含水層抽取之總用水量？",

    "Wastewater treatment\nA process in place to treat wastewater.":
    "廢水處理\n貴校是否已有廢水處理程序？",

    "Preventing water system pollution\nProcesses to prevent polluted water entering the water system, including pollution caused by accidents and incidents at the university.":
    "防止水系統污染\n貴校是否有程序防止污染水進入水系統（含校內事故與事件造成之污染）？",

    "Free drinking water provided\nProvide free drinking water for students, staff and/or visitors (e.g. drinking water fountains).":
    "免費飲用水\n貴校是否為學生、教職員及／或訪客提供免費飲用水（如飲水機）？",

    "Water-conscious building standards\nApply building standards to minimise water use":
    "節水建築標準\n貴校是否採用建築標準以最小化用水？",

    "Water-conscious planting\nPlant landscapes to minimise water usage. (e.g. use drought-tolerant plants)":
    "節水植栽\n貴校是否以最小化用水方式規劃景觀植栽（如耐旱植物）？",

    "Water reuse policy\nHave a policy to maximise water reuse across the university?":
    "水再利用政策\n貴校是否訂有最大化全校水再利用之政策？",

    "Water reuse measurement\nMeasure the reuse of water across the university?":
    "水再利用量測\n貴校是否量測全校水再利用情形？",

    "Water management educational opportunities\nProvide educational opportunities for local communities to learn about good water management":
    "水資源管理教育機會\n貴校是否為地方社區提供優良水資源管理之教育機會？",

    "Off-campus water conservation support\nSupport practical water conservation off campus":
    "校外節水支持\n貴校是否支持校外實務節水？",

    "Sustainable water extraction on campus\nWhere water is extracted (for example from aquifers, lakes or rivers) utilise sustainable water extraction technologies on associated university grounds on and off campus.":
    "校園永續取水\n若有取水（如自含水層、湖泊或河川），貴校是否在相關校地（校內外）使用永續取水技術？",

    "Cooperation on water security\nCooperate with local, regional, national, or global governments on water security.":
    "水安全合作\n貴校是否與地方、區域、國家或全球政府就水安全合作？",

    "Promoting conscious water usage on campus\nActively promote conscious water usage on campus,":
    "校園推廣節水意識用水\n貴校是否積極在校園推廣有意識之用水？",

    "Promoting conscious water usage in the wider community.\nActively promote conscious water usage in the wider community":
    "在更廣泛社區推廣節水意識用水\n貴校是否積極在更廣泛社區推廣有意識之用水？",

    "Energy-efficient renovation and building\nHave a policy in place for ensuring all renovations or new builds are following energy efficiency standards":
    "節能整修與建築\n貴校是否訂有政策，確保所有整修或新建遵循能源效率標準？",

    "Upgrade buildings to higher energy efficiency\nHave plans to upgrade existing buildings to higher energy efficiency":
    "提升既有建築能源效率\n貴校是否有計畫將既有建築升級至更高能源效率？",

    "Carbon reduction and emission reduction process\nHave a process for carbon management and reducing carbon dioxide emissions":
    "減碳與排放減量程序\n貴校是否有碳管理及減少二氧化碳排放之程序？",

    "Plan to reduce energy consumption\nHave an energy efficiency plan in place to reduce overall energy consumption":
    "降低能源消耗計畫\n貴校是否訂有能源效率計畫以降低整體能源消耗？",

    "Energy wastage identification\nUndergo energy reviews to identify areas where energy waste is highest":
    "能源浪費辨識\n貴校是否進行能源檢視，以找出能源浪費最高之區域？",

    "Divestment policy\nHave a policy on divesting investments from carbon-intensive energy industries notably coal and oil":
    "撤資政策\n貴校是否訂有自高碳密集能源產業（尤其煤與石油）撤資之政策？",

    "Local community outreach for energy efficiency\nProvide programmes for local community to learn about importance of energy efficiency and clean energy":
    "地方社區能源效率外展\n貴校是否提供地方社區認識能源效率與潔淨能源重要性之計畫？",

    "100% renewable energy pledge\nPromote a public pledge toward 100% renewable energy beyond the university":
    "100% 再生能源承諾\n貴校是否推動校園外邁向 100% 再生能源之公開承諾？",

    "Energy efficiency services for industry\nProvide direct services to local industry aimed at improving energy efficiency and clean energy (energy efficiency assessments, workshops, research renewable energy options)":
    "產業能源效率服務\n貴校是否向地方產業提供直接服務，以改善能源效率與潔淨能源（能源效率評估、工作坊、再生能源選項研究）？",

    "Policy development for clean energy technology\nInform and support governments in clean energy and energy-efficient technology policy development":
    "潔淨能源技術政策發展\n貴校是否協助政府發展潔淨能源與節能技術政策？",

    "Assistance to low-carbon innovation\nProvide assistance for start-ups that foster and support a low-carbon economy or technology":
    "低碳創新協助\n貴校是否協助推動低碳經濟或技術之新創？",

    "Employment practice living wage\nPay all staff and faculty at least the living wage, defined as the local living wage (if government defines this) or the local financial poverty indicator for a family of four (expressed as an hourly wage)":
    "就業實務：基本生活工資\n貴校是否支付全體教職員至少基本生活工資（以地方政府定義之生活工資，或以四口之家貧困指標換算之時薪）？",

    "Employment practice unions\nRecognize unions (freedom of association & collective bargaining) for all, including women & international staff":
    "就業實務：工會\n貴校是否承認全體（含女性與國際員工）之工會（結社自由與集體協商）？",

    "Employment policy on discrimination\nHave a policy on ending discrimination in the workplace (including discrimination based on religion, sexuality, gender, age, or refugee status)":
    "就業歧視政策\n貴校是否訂有終結職場歧視之政策（含宗教、性傾向、性別、年齡或難民身分）？",

    "Employment policy modern slavery\nHave a policy commitment against forced labour, modern slavery, human trafficking and child labour":
    "現代奴役政策\n貴校是否承諾反對強迫勞動、現代奴役、人口販運與童工？",

    "Employment practice equivalent rights outsourcing\nHave a policy on guaranteeing equivalent rights of workers when outsourcing activities to third parties":
    "外包同等權利\n貴校是否訂有政策，確保委外予第三方時勞工享有同等權利？",

    "Employment policy pay scale equity\nHave a policy on pay scale equity including a commitment to measurement and elimination of\ngender pay gaps":
    "薪資尺度公平政策\n貴校是否訂有薪資尺度公平政策，並承諾量測與消除性別薪資差距？",

    "Tracking pay scale for gender equity\nMeasurement or tracking pay scale gender equity":
    "薪資尺度性別公平追蹤\n貴校是否量測或追蹤薪資尺度之性別公平？",

    "Employment practice appeal process\nHave a process for employees to appeal on employee rights and/or pay":
    "就業申訴程序\n貴校是否有員工就權利及／或薪資提出申訴之程序？",

    "Employment practice labour rights\nRecognise labour rights (freedom of association and collective bargaining) for all, including women and international staff":
    "就業實務：勞動權利\n貴校是否承認全體（含女性與國際員工）之勞動權利（結社自由與集體協商）？",

    "Non-discriminatory admissions policy\nHave an admissions policy which is non-discriminatory or which details and explains the logic for any appropriate positive discrimination policies in admissions":
    "不歧視招生政策\n貴校是否訂有不歧視之招生政策，或對任何適當之積極差別待遇招生政策說明其邏輯？",

    "Access to university track underrepresented groups applications\nMeasure and track applications and admissions of underrepresented (and potentially underrepresented) groups including ethnic minorities, low income students, non-traditional students, women, LGBT students, disabled students, and newly settled refugee students.":
    "追蹤代表性不足群體申請\n貴校是否量測並追蹤代表性不足（及潛在不足）群體之申請與入學（含少數族群、低收入、非傳統學生、女性、LGBT、身心障礙及新定居難民學生）？",

    "Access to university underrepresented groups recruit\nTake planned actions  to recruit students, staff, and faculty from under-represented groups":
    "招收代表性不足群體\n貴校是否採取有計畫之行動，招收代表性不足群體之學生與教職員？",

    "Anti-discrimination policies\nHave an anti-discrimination policy that covers the institution and its operations.":
    "反歧視政策\n貴校是否訂有涵蓋機構及其運作之反歧視政策？",

    "University diversity officer\nHave a diversity and equality committee, office or officer (or the equivalent) tasked by the administration or governing body to advise on and implement policies, programmes and trainings related to diversity, equity, inclusion and human rights on campus.":
    "大學多元事務單位／人員\n貴校是否設有多元與平等委員會、辦公室或專責人員（或同等單位），由行政或治理單位責成，就校園多元、公平、包容與人權提供建議並推動政策、計畫與訓練？",

    "Support for underrepresented groups\nProvide mentoring, counselling, or peer support programmes to support students, staff, and faculty from underrepresented groups.":
    "代表性不足群體支持\n貴校是否提供 mentorship、諮商或同儕支持計畫，支持代表性不足群體之學生與教職員？",

    "Accessible facilities\nProvide accessible facilities for people with disabilities.":
    "無障礙設施\n貴校是否提供身心障礙者之無障礙設施？",

    "Disability support services\nSupport services for people with disabilities.":
    "身心障礙支持服務\n貴校是否提供身心障礙者支持服務？",

    "Disability support services\nProvide support services for people with disabilities.":
    "身心障礙支持服務\n貴校是否提供身心障礙者支持服務？",

    "Disability access scheme\nProvide access schemes for people with disabilities such as mentoring or other targeted support":
    "身心障礙近用方案\n貴校是否提供身心障礙者近用方案（如 mentorship 或其他針對性支持）？",

    "Disability accommodation policy\nHave reasonable accommodation policy or strategy for people with disabilities including adequate funding":
    "身心障礙合理調整政策\n貴校是否訂有身心障礙者合理調整政策或策略，並有充足經費？",

    "Anti-harassment policy\nHave an anti-harassment policy that covers the institution and its operations":
    "反騷擾政策\n貴校是否訂有涵蓋機構及其運作之反騷擾政策？",

    "Public access to buildings\nProvide public access to buildings and/or monuments or natural heritage landscapes of cultural significance":
    "建築公共近用\n貴校是否對具文化意義之建築及／或紀念物或自然遺產景觀提供公共近用？",

    "Public access to libraries\nProvide public access to libraries including books and publications":
    "圖書館公共近用\n貴校是否提供圖書館（含書籍與出版品）之公共近用？",

    "Public access to museums\nProvide public access to museums, exhibition spaces or galleries, or works of art and artefacts":
    "博物館公共近用\n貴校是否提供博物館、展覽空間或藝廊，或藝術品與文物之公共近用？",

    "Public access to green spaces\nProvide free public access to open spaces and green spaces":
    "綠地公共近用\n貴校是否免費提供開放空間與綠地之公共近用？",

    "Arts and heritage contribution\nContribute to local arts, in terms of number of annual public performances of university choirs, theatre groups, orchestras etc… either ad-hoc or as part of an ongoing programme":
    "藝術與遺產貢獻\n貴校是否透過大學合唱團、劇團、管弦樂團等年度公開演出次數，對地方藝術作出貢獻（臨時或持續計畫皆可）？",

    "Record and preserve cultural heritage\nDeliver projects to record and preserve intangible cultural heritage such as local folklore, traditions, language, and knowledge. This can include the heritage of displaced communities.":
    "記錄與保存文化遺產\n貴校是否執行計畫以記錄並保存非物質文化遺產（如地方民俗、傳統、語言與知識）？可含流離失所社區之遺產。",

    "Sustainable practices targets\nMeasure and set targets for more sustainable commuting (walking, cycling or other non-motorized transport, vanpools, carpools, shuttlebus or public transportation, motorcycle, scooter or moped, or electric vehicles)":
    "永續實務目標\n貴校是否量測並設定更永續通勤目標（步行、自行車或其他非機動運輸、共乘、接駁／大眾運輸、機車／電動車等）？",

    "Promote sustainable commuting\nUndertake actions to promote more sustainable commuting":
    "推廣永續通勤\n貴校是否採取行動推廣更永續之通勤？",

    "Allow remote working\nPromote or allow telecommuting or remote working for employees as a matter of policy or standard practice, or offer a condensed working week to reduce employee commuting":
    "允許遠距工作\n貴校是否以政策或標準實務推廣／允許遠距工作，或提供壓縮工時以減少員工通勤？",

    "Affordable housing for employees\nProvide affordable housing for employees":
    "員工可負擔住房\n貴校是否為員工提供可負擔住房？",

    "Affordable housing for students\nProvide affordable housing for students":
    "學生可負擔住房\n貴校是否為學生提供可負擔住房？",

    "Pedestrian priority on campus\nPrioritise pedestrian access on campus":
    "校園行人優先\n貴校是否在校園優先行人通行？",

    "Local authority collaboration regarding planning and development\nWork with local authorities to address planning issues and development, including ensuring that local residents are able to access affordable housing":
    "與地方主管機關就規劃發展合作\n貴校是否與地方主管機關合作處理規劃與發展議題，包括確保地方居民可近用可負擔住房？",

    "Planning development - new build standards\nBuild new buildings to sustainable standards":
    "規劃發展－新建標準\n貴校新建建築是否依永續標準興建？",

    "Building on brownfield sites\nBuild on brownfield sites, where possible":
    "在棕地興建\n貴校是否在可能情況下於棕地興建？",

    "Ethical sourcing policy\nHave a policy on ethical sourcing of food and supplies":
    "倫理採購政策\n貴校是否訂有食品與物資倫理採購政策？",

    "Policy waste disposal - hazardous materials\nHave a policy, process or practice on waste disposal - Covering hazardous materials":
    "廢棄物處理政策－危害物質\n貴校是否訂有涵蓋危害物質之廢棄物處理政策、程序或實務？",

    "Policy waste disposal - landfill policy\nHave a policy on waste disposal - to measure the amount of waste sent to landfill and recycled":
    "廢棄物處理政策－掩埋政策\n貴校是否訂有廢棄物處理政策，以量測送往掩埋與回收之廢棄物量？",

    "Policy for minimisation of plastic use\nHave policies around use minimisation of plastic":
    "塑膠減量政策\n貴校是否訂有塑膠使用最小化政策？",

    "Policy for minimisation of disposable items\nHave policies around use minimisation of disposable items":
    "一次性用品減量政策\n貴校是否訂有一次性用品使用最小化政策？",

    "Disposable policy: extensions to services\nEnsuring these policies extend to outsourced services and the supply chain":
    "一次性用品政策：延伸至服務\n上述政策是否延伸至委外服務與供應鏈？",

    "Minimisation policies extended to suppliers\nEnsuring these policies extend to outsourced suppliers and the supply chain - (for example suppliers of equipment, stationery, building contracts)":
    "減量政策延伸至供應商\n上述政策是否延伸至委外供應商與供應鏈（如設備、文具、營建合約供應商）？",

    "Waste tracking\nMeasure the amount of waste generated and recycled across the university":
    "廢棄物追蹤\n貴校是否量測全校廢棄物產生量與回收量？",

    "Local education programmes on climate\nProvide local education programmes or campaigns on climate change risks, impacts, mitigation, adaptation, impact reduction and early warning":
    "地方氣候教育計畫\n貴校是否提供地方教育計畫或宣導，涵蓋氣候變遷風險、衝擊、減緩、調適、衝擊減量與預警？",

    "Climate Action Plan, shared\nHave a university Climate Action plan, shared with local government and local community groups":
    "氣候行動計畫（共享）\n貴校是否訂有氣候行動計畫，並與地方政府及地方社區團體共享？",

    "Co-operative planning for climate change disasters\nParticipate in co-operative planning for climate change disasters, that may include the displacement of people both within a country and across borders, working with government":
    "氣候變遷災害合作規劃\n貴校是否與政府參與氣候變遷災害合作規劃（可含國內及跨境人口流離）？",

    "Inform and support government\nInform and support local or regional government in local climate change disaster or risk early warning and monitoring":
    "告知並支持政府\n貴校是否就地方氣候變遷災害或風險預警與監測，告知並支持地方或區域政府？",

    "Environmental education collaborate with NGO\nCollaborate with NGOs on climate adaptation":
    "與 NGO 環境教育合作\n貴校是否與 NGO 就氣候調適合作？",

    "Low-carbon energy tracking\nMeasure the amount of low carbon energy used across the university":
    "低碳能源追蹤\n貴校是否量測全校低碳能源使用量？",

    "Commitment to carbon neutral university\nHave a target date by which it will become carbon neutral according to the Greenhouse Gas Protocols?":
    "碳中和大學承諾\n貴校是否依溫室氣體盤查議定書訂有達成碳中和之目標日期？",

    "Fresh-water ecosystems (community outreach)\nOffer educational programmes on fresh-water ecosystems (water irrigation practices, water management/conservation) for local or national communities":
    "淡水生態系（社區外展）\n貴校是否為地方或全國社區提供淡水生態系教育計畫（灌溉實務、水資源管理／保育）？",

    "Sustainable fisheries (community outreach)\nOffer educational programme or outreach for local or national communities on sustainable management of fisheries, aquaculture and tourism":
    "永續漁業（社區外展）\n貴校是否為地方或全國社區提供漁業、水產養殖與觀光永續管理之教育或外展？",

    "Overfishing (community outreach)\nOffer educational outreach activities for local or national communities to raise awareness about overfishing, illegal, unreported and unregulated fishing and destructive fishing practices":
    "過度捕撈（社區外展）\n貴校是否為地方或全國社區辦理教育外展，提升對過度捕撈、非法／未報告／未受規範捕撈及破壞性捕撈之認識？",

    "Conservation and sustainable utilisation of the oceans (events)\nSupport or organise events aimed to promote conservation and sustainable utilisation of the oceans, seas, lakes, rivers and marine resources":
    "海洋保育與永續利用（活動）\n貴校是否支持或舉辦活動，推廣海洋、海域、湖泊、河川與海洋資源之保育與永續利用？",

    "Food from aquatic ecosystems (policies)\nHave a policy to ensure that food on campus that comes from aquatic ecosystems is sustainably harvested":
    "水生生態系來源食品（政策）\n貴校是否訂有政策，確保校園來自水生生態系之食品為永續採收？",

    "Maintain ecosystems and their biodiversity (direct work)\nWork directly (research and/or engagement with industries) to maintain and extend existing ecosystems and their biodiversity, of both plants and animals, especially ecosystems under threat":
    "維護生態系及其生物多樣性（直接工作）\n貴校是否直接（研究及／或與產業合作）維護並擴展既有生態系及其動植物生物多樣性，尤其受威脅生態系？",

    "Technologies towards aquatic ecosystem damage prevention (direct work)\nWork directly (research and/or engagement with industries) on technologies or practices that enable marine industry to minimise or prevent damage to aquatic ecosystems":
    "水生生態系損害預防技術（直接工作）\n貴校是否直接（研究及／或與產業合作）發展技術或實務，使海洋產業能最小化或防止對水生生態系之損害？",

    "Water discharge guidelines and standards\nHave water quality standards and guidelines for water discharges (to uphold water quality in order to protect ecosystems, wildlife, and human health and welfare)":
    "排水指引與標準\n貴校是否訂有排水水質標準與指引（以維護水質、保護生態系、野生動物與人類健康福祉）？",

    "Action plan to reducing plastic waste\nHave an action plan in place to reduce plastic waste on campus":
    "塑膠廢棄物減量行動計畫\n貴校是否訂有減少校園塑膠廢棄物之行動計畫？",

    "Reducing marine pollution (policy)\nHave a policy on preventing and reducing marine pollution of all kinds, in particular from land-based activities":
    "減少海洋污染（政策）\n貴校是否訂有防止並減少各類海洋污染之政策（尤其陸域活動來源）？",

    "Minimizing alteration of aquatic ecosystems (plan)\nHave a plan to minimise physical, chemical and biological alterations of related aquatic ecosystems":
    "最小化水生生態系改變（計畫）\n貴校是否訂有計畫，最小化相關水生生態系之物理、化學與生物改變？",

    "Monitoring the health of aquatic ecosystems\nMonitor the health of aquatic ecosystems":
    "監測水生生態系健康\n貴校是否監測水生生態系健康？",

    "Programs towards good aquatic stewardship practices\nDevelop and support programmes and incentives that encourage and maintain good aquatic stewardship practices":
    "優良水域stewardship方案\n貴校是否發展並支持鼓勵與維持優良水域stewardship之計畫與誘因？",

    "Collaboration for shared aquatic ecosystems\nCollaborate with the local community in efforts to maintain shared aquatic ecosystems":
    "共享水生生態系合作\n貴校是否與地方社區合作維護共享水生生態系？",

    "Watershed management strategy\nHave implemented a watershed management strategy based on location specific diversity of aquatic species":
    "集水區管理策略\n貴校是否已依在地水生物種多樣性實施集水區管理策略？",

    "Events about sustainable use of land\nSupport or organise events aimed to promote conservation and sustainable utilisation of the land, including forests and wild land":
    "土地永續利用相關活動\n貴校是否支持或舉辦活動，推廣土地（含森林與荒地）之保育與永續利用？",

    "Sustainably farmed food on campus\nHave policies to ensure that food on campus is sustainably farmed":
    "校園永續農產食品\n貴校是否訂有政策，確保校園食品為永續耕作？",

    "Maintain and extend current ecosystems' biodiversity\nWork directly to maintain and extend existing ecosystems and their biodiversity, of both plants and animals, especially ecosystems under threat":
    "維護並擴展現行生態系生物多樣性\n貴校是否直接維護並擴展既有生態系及其動植物生物多樣性，尤其受威脅生態系？",

    "Educational programmes on ecosystems\nOffer educational programmes on ecosystems (looking at wild flora and fauna) for local or national communities?":
    "生態系教育計畫\n貴校是否為地方或全國社區提供生態系教育計畫（關注野生動植物）？",

    "Sustainable management of land for agriculture (educational outreach)\nOffer educational programme/outreach for local or national communities on sustainable management of land for agriculture":
    "農業土地永續管理（教育外展）\n貴校是否為地方或全國社區提供農業土地永續管理之教育／外展？",

    "Sustainable management of land for tourism (educational outreach)\nOffer educational programme/outreach for local or national communities on sustainable management of land for tourism":
    "觀光土地永續管理（教育外展）\n貴校是否為地方或全國社區提供觀光土地永續管理之教育／外展？",

    "Sustainable use, conservation and restoration of land (policy)\nHave a policy to ensure the conservation, restoration and sustainable use of terrestrial ecosystems associated with the university, in particular forests, mountains and drylands":
    "土地永續利用、保育與復育（政策）\n貴校是否訂有政策，確保與大學相關陸域生態系（尤其森林、山岳與旱地）之保育、復育與永續利用？",

    "Monitoring IUCN and other conservation species (policies)\nHave a policy to identify, monitor and protect any IUCN Red Listed species and national conservation list species with habits in areas affected by the operation of your university":
    "監測 IUCN 及其他保育物種（政策）\n貴校是否訂有政策，識別、監測並保護受大學營運影響區域內之 IUCN 紅皮書物種及國家保育名錄物種？",

    "Local biodiversity included in planning and development\nInclude local biodiversity into any planning and development process (e.g. construction of new buildings)":
    "規劃發展納入地方生物多樣性\n貴校是否在任何規劃與發展過程（如新建）納入地方生物多樣性？",

    "Alien species impact reduction (policies)\nHave a policy to reduce the impact of alien species on Campus":
    "外來種衝擊減量（政策）\n貴校是否訂有減少校園外來種衝擊之政策？",

    "Collaboration for shared land ecosystems\nCollaborate with the local community to maintain shared land ecosystems":
    "共享陸域生態系合作\n貴校是否與地方社區合作維護共享陸域生態系？",

    "Policy on plastic waste reduction\nHave a policy on reducing plastic waste on campus":
    "塑膠廢棄物減量政策\n貴校是否訂有減少校園塑膠廢棄物之政策？",

    "Policy on hazardous waste disposal\nHave a policy, process or practice on waste disposal covering hazardous materials":
    "危害廢棄物處理政策\n貴校是否訂有涵蓋危害物質之廢棄物處理政策、程序或實務？",

    "Elected representation\nHave elected representation on the university's highest governing body from: students (both undergraduate and graduate), faculty, and staff (non-faculty employees)":
    "選舉代表\n貴校最高治理機關是否有來自學生（大學部與研究所）、faculty 與職員（非 faculty）之選舉代表？",

    "Students' union\nRecognise an independent students' union":
    "學生會\n貴校是否承認獨立學生會？",

    "Identify and engage with local stakeholders\nHave written policies and procedures to identify local stakeholders external to the university and engage with them":
    "識別並與地方利害關係人互動\n貴校是否訂有書面政策與程序，以識別校外地方利害關係人並與之互動？",

    "Participatory bodies for stakeholder engagement\nEnsure that local stakeholders in the university – including local residents, local government, and civil society representativels (which may include groups such as refugee resettlement agencies) – have a meaningful mechanism or for participating in university decision making.":
    "利害關係人參與機制\n貴校是否確保大學之地方利害關係人（含地方居民、地方政府與公民社會代表，可含難民安置機構等）有有意義之機制參與大學決策？",

    "University principles on corruption and bribery\nPublish the university's principles and commitments on organized crime, corruption & bribery":
    "反貪腐與賄賂原則\n貴校是否公開大學對組織犯罪、貪腐與賄賂之原則與承諾？",

    "Academic freedom policy\nHave a policy on supporting academic freedom (freedom to choose areas of research and to speak and teach publicly about the area of their research)":
    "學術自由政策\n貴校是否訂有支持學術自由之政策（選擇研究領域，以及公開談論與教授其研究領域之自由）？",

    "Publish financial data\nPublish university financial data":
    "公開財務資料\n貴校是否公開大學財務資料？",

    "Provide expert advice to government\nProvide specific expert advice to local, regional or national government (for example through policy guidance, participation in committees, provision of evidence)":
    "向政府提供專家建議\n貴校是否向地方、區域或國家政府提供具體專家建議（如政策指引、參與委員會、提供證據）？",

    "Policy- and lawmakers outreach and education\nProvide outreach, general education, upskilling and capacity-building to policy and lawmakers on relevant topics including economics, law, technology, migration and displacement, and climate change":
    "政策與立法者外展與教育\n貴校是否向政策與立法者提供外展、通識、培力與能力建構（含經濟、法律、技術、移民與流離、氣候變遷等）？",

    "Participation in government research\nUndertake policy-focused research in collaboration with government departments":
    "參與政府研究\n貴校是否與政府部門合作進行政策導向研究？",

    "Neutral platform to discuss issues\nProvide a neutral platform and \"safe\" space for different political stakeholders to come together to frankly discuss challenges":
    "中立討論平台\n貴校是否提供中立平台與「安全」空間，供不同政治利害關係人坦誠討論挑戰？",

    "Neutral platform to discuss issues\nProvide a neutral platform and 'safe' space for different political stakeholders to come together to frankly discuss challenges":
    "中立討論平台\n貴校是否提供中立平台與「安全」空間，供不同政治利害關係人坦誠討論挑戰？",

    "Relationships with regional NGOs and government for SDG policy\nHave direct involvement in, or input into, national government or regional non-government organisations, SDG policy development - including identifying problems and challenges, developing policies and strategies, modelling likely futures with and without interventions, monitoring and reporting on interventions, and enabling adaptive management":
    "與區域 NGO 及政府之 SDG 政策關係\n貴校是否直接參與或投入國家政府或區域非政府組織之 SDG 政策發展（含問題挑戰識別、政策策略研擬、介入前後情境模擬、監測報告與調適管理）？",

    "Cross sectoral dialogue about SDGs\nInitiate and participate in cross-sectoral dialogue about the SDGs, e.g. conferences involving government or NGOs":
    "SDG 跨部門對話\n貴校是否發起並參與 SDG 跨部門對話（如含政府或 NGO 之會議）？",

    "International collaboration data gathering for SDG\nParticipate in international collaboration on gathering or measuring data for the SDGs":
    "SDG 國際資料蒐集合作\n貴校是否參與 SDG 資料蒐集或量測之國際合作？",

    "Collaboration for SDG best practice\nThrough international collaboration and research, review comparative approaches and develop international best practice on tackling the SDGs":
    "SDG 最佳實務合作\n貴校是否透過國際合作與研究，檢視比較方法並發展因應 SDG 之國際最佳實務？",

    "Collaboration with NGOs for SDGs\nCollaborate with NGOs to tackle the SDGs through: student volunteering programmes, research programmes, or development of educational resources":
    "與 NGO 合作推動 SDG\n貴校是否與 NGO 合作因應 SDG（透過：學生志工計畫、研究計畫或發展教育資源）？",

    "Education for SDGs commitment to meaningful education\nHave a commitment to meaningful education around the SDGs across the university, relevant and applicable to all students":
    "SDG 有意義教育之承諾\n貴校是否承諾在全校推動與全體學生相關且適用之 SDG 有意義教育？",

    "Education for SDGs specific courses on sustainability\nHave dedicated courses (full degrees, or electives) that address sustainability and the SDGs.":
    "SDG 永續專責課程\n貴校是否設有專責課程（完整學位或選修）探討永續與 SDG？",

    "Education for SDGs in the wider community\nHave dedicated outreach educational activities for the wider community, which could include alumni, local residents, displaced people":
    "更廣泛社區之 SDG 教育\n貴校是否為更廣泛社區（可含校友、地方居民、流離失所者）辦理專責外展教育活動？",

    "Sustainable Literacy\nThis question explores how you evaluate your students' ability to learn and retain key concepts of sustainability.  For 2025 we will not score this question but will use it to inform our decisions for 2026.\nMeasure the sustainability literacy of students.":
    "永續素養\n本题探討貴校如何評估學生學習並保留永續關鍵概念之能力。2025 年不計分，但將作為 2026 決策參考。\n貴校是否量測學生之永續素養？",
}

# SDG report lines pattern
for i in range(1, 18):
    en = f"Publication of SDG reports - per SDG\nPublish progress against against SDG{i}, either individually or within an annual report"
    # also single "against"
    en2 = f"Publication of SDG reports - per SDG\nPublish progress against  SDG{i}, either individually or within an annual report"
    zh = f"發布 SDG 報告－各 SDG\n貴校是否單獨或於年報中公布 SDG{i} 之進展？"
    INDICATORS[en] = zh
    INDICATORS[en2] = zh

# Achieve-by scoring note
INDICATORS[
    "Achieve by\n•\tDate for achieved prior to 2023 – 4 points\n•\tDate for achieved by: 2023-2029 – 3 points\n•\tDate for achieved by: 2030-2039 – 2 points\n•\tDate for achieved by: 2040-2049 – 1 point\n•\tDate for achieved by: 2050 or later – 0.5"
] = (
    "達成期限\n• 2023 年前已達成 － 4 分\n• 2023–2029 達成 － 3 分\n• 2030–2039 達成 － 2 分\n• 2040–2049 達成 － 1 分\n• 2050 或之後達成 － 0.5 分"
)


def clean_text(s: str) -> str:
    if s is None:
        return ""
    s = str(s)
    s = s.replace("_x000D_", "")
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    # smart quotes / bullets / dashes
    for a, b in [
        ("\u2018", "'"), ("\u2019", "'"), ("\u201c", '"'), ("\u201d", '"'),
        ("\u2013", "-"), ("\u2014", "-"), ("\u2026", "..."),
        ("\uf0a7", "•"), ("\u00a0", " "), ("\u2022", "•"),
        ("\u2010", "-"), ("\u2212", "-"),
    ]:
        s = s.replace(a, b)
    # collapse trailing spaces on lines
    s = "\n".join(line.rstrip() for line in s.split("\n"))
    return s.strip()


def norm_key(s: str) -> str:
    s = clean_text(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def to_question_en(text: str) -> str:
    """Lightly turn imperative body into a question; keep titles. Minimal change."""
    text = clean_text(text)
    if not text:
        return text
    # short option / number label / metric title only: keep
    if "\n" not in text:
        # already a question?
        if text.endswith("?"):
            return text
        # imperative starters -> question
        starters = (
            "Have ", "Provide ", "Measure ", "Share ", "Deliver ", "Host ",
            "Undertake ", "Encourage ", "Pay ", "Recognize ", "Recognise ",
            "Take ", "Work ", "Build ", "Prioritise ", "Prioritize ",
            "Apply ", "Plant ", "Support ", "Cooperate ", "Actively ",
            "Undergo ", "Promote ", "Inform ", "Offer ", "Monitor ",
            "Develop ", "Collaborate ", "Include ", "Ensure ", "Publish ",
            "Initiate ", "Participate ", "Organise ", "Organize ",
        )
        for st in starters:
            if text.startswith(st):
                body = text
                # strip trailing punctuation
                body = body.rstrip(".")
                return f"Does your university {body[0].lower() + body[1:]}?"
        return text

    lines = text.split("\n")
    title = lines[0]
    body = "\n".join(lines[1:]).strip()
    if not body:
        return title
    # if body already question
    if body.endswith("?"):
        return f"{title}\n{body}"
    # convert first sentence-ish
    starters = (
        "Have ", "Provide ", "Measure ", "Share ", "Deliver ", "Host ",
        "Undertake ", "Encourage ", "Pay ", "Recognize ", "Recognise ",
        "Take ", "Work ", "Build ", "Prioritise ", "Prioritize ",
        "Apply ", "Plant ", "Support ", "Cooperate ", "Actively ",
        "Undergo ", "Promote ", "Inform ", "Offer ", "Monitor ",
        "Develop ", "Collaborate ", "Include ", "Ensure ", "Publish ",
        "Initiate ", "Participate ", "Organise ", "Organize ",
        "Targets ", "Graduation", "Programmes ", "Schemes ", "A process ",
        "Processes ", "A policy ", "Systematically ", "Contribute ",
    )
    for st in starters:
        if body.startswith(st):
            # Keep as: Title + Does your university ... ?
            # For "Targets/Graduation/Programmes/Schemes/A process" use Does your university have...
            if body.startswith(("Targets ", "Graduation", "Programmes ", "Schemes ", "A process ", "Processes ", "A policy ", "Systematically ", "Contribute ")):
                b = body.rstrip(".")
                if body.startswith("A process "):
                    q = f"Does your university have {b[0].lower() + b[1:]}?"
                elif body.startswith("Processes "):
                    q = f"Does your university have {b[0].lower() + b[1:]}?"
                elif body.startswith("A policy "):
                    q = f"Does your university have {b[0].lower() + b[1:]}?"
                elif body.startswith("Targets "):
                    q = f"Does your university have {b[0].lower() + b[1:]}?"
                elif body.startswith("Graduation"):
                    q = f"Does your university have {b[0].lower() + b[1:]}?"
                elif body.startswith("Programmes "):
                    q = f"Does your university have {b[0].lower() + b[1:]}?"
                elif body.startswith("Schemes "):
                    q = f"Does your university have {b[0].lower() + b[1:]}?"
                elif body.startswith("Systematically "):
                    q = f"Does your university {b[0].lower() + b[1:]}?"
                else:
                    q = f"Does your university {b[0].lower() + b[1:]}?"
                return f"{title}\n{q}"
            b = body.rstrip(".")
            q = f"Does your university {b[0].lower() + b[1:]}?"
            return f"{title}\n{q}"
    return text


# Extra aliases for summary/example wording variants (first-line title -> ZH)
TITLE_ZH = {
    "Bottom financial quintile admission target": "最低所得五分位入學目標",
    "Bottom financial quintile student success": "最低所得五分位學生成功",
    "Low-income student support": "低收入學生支持",
    "Bottom financial quintile student support": "最低所得五分位學生支持",
    "Low or lower-middle income countries student support": "低度／中低所得國家學生支持",
    "Local start-up assistance": "地方新創協助",
    "Local start-up financial assistance": "地方新創財務協助",
    "Programmes for services access": "基本服務近用計畫",
    "Policy addressing poverty": "因應貧窮之政策參與",
    "Campus food waste tracking": "校園食物浪費追蹤",
    "Student food insecurity and hunger": "學生糧食不安全與飢餓",
    "Students hunger interventions": "學生飢餓介入措施",
    "Studentshunger interventions": "學生飢餓介入措施",
    "Sustainable food choices on campus": "校園永續飲食選擇",
    "Healthy and affordable food choices": "健康且可負擔之飲食選擇",
    "Staff hunger interventions": "教職員飢餓介入措施",
    "Access to food security knowledge": "糧食安全知識近用",
    "Events for local farmers and food producers": "地方農民與食品生產者活動",
    "University access to local farmers and food producers": "大學設施開放予地方農民與食品生產者",
    "Sustainable food purchases": "永續食品採購",
    "Current collaborations with health institutions": "與健康機構之現行合作",
    "Health outreach programmes": "健康外展計畫",
    "Shared sports facilities": "共享運動設施",
    "Sexual and reproductive health care services for students": "學生性與生殖健康照護服務",
    "Mental health support for students": "學生心理健康支持",
    "Smoke-free policy": "無菸政策",
    "Mental health support for staff": "教職員心理健康支持",
    "Public resources (lifelong learning)": "公共資源（終身學習）",
    "Public events (lifelong learning)": "公開活動（終身學習）",
    "Vocational training events (lifelong learning)": "職業訓練活動（終身學習）",
    "Education outreach activities beyond campus": "校園外教育外展活動",
    "Lifelong learning access policy": "終身學習近用政策",
    "Tracking access measures": "近用追蹤措施",
    "Policy for women applications and entry": "女性申請與入學政策",
    "Women's access schemes": "女性近用方案",
    "Women's application in underrepresented subjects": "女性於代表性不足學科之申請",
    "Policy of non-discrimination against women": "禁止歧視女性政策",
    "Policy of non-discrimination vs women": "禁止歧視女性政策",
    "Non-discrimination policies for transgender": "跨性別不歧視政策",
    "Maternity policy": "產假／孕產政策",
    "Childcare facilities for students": "學生托育設施",
    "Childcare facilities for staff and faculty": "教職員托育設施",
    "Women's mentoring schemes": "女性 mentorship 方案",
    "Track women's graduation rate": "追蹤女性畢業率",
    "Policies protecting those reporting discrimination": "保護檢舉歧視者之政策",
    "Paternity policy": "陪產／育嬰假政策",
    "Water consumption tracking": "用水量追蹤",
    "Wastewater treatment": "廢水處理",
    "Preventing water system pollution": "防止水系統污染",
    "Free drinking water provided": "免費飲用水",
    "Water-conscious building standards": "節水建築標準",
    "Water-conscious planting": "節水植栽",
    "Water reuse policy": "水再利用政策",
    "Water re-use policy": "水再利用政策",
    "Water reuse measurement": "水再利用量測",
    "Water re-use measurement": "水再利用量測",
    "Water management educational opportunities": "水資源管理教育機會",
    "Off-campus water conservation support": "校外節水支持",
    "Sustainable water extraction on campus": "校園永續取水",
    "Cooperation on water security": "水安全合作",
    "Promoting conscious water usage on campus": "校園推廣節水意識用水",
    "Promoting conscious water usage in the wider community.": "在更廣泛社區推廣節水意識用水",
    "Energy-efficient renovation and building": "節能整修與建築",
    "Upgrade buildings to higher energy efficiency": "提升既有建築能源效率",
    "Carbon reduction and emission reduction process": "減碳與排放減量程序",
    "Plan to reduce energy consumption": "降低能源消耗計畫",
    "Energy wastage identification": "能源浪費辨識",
    "Divestment policy": "撤資政策",
    "Local community outreach for energy efficiency": "地方社區能源效率外展",
    "100% renewable energy pledge": "100% 再生能源承諾",
    "Energy efficiency services for industry": "產業能源效率服務",
    "Policy development for clean energy technology": "潔淨能源技術政策發展",
    "Policy development for clean energy tech": "潔淨能源技術政策發展",
    "Assistance to low-carbon innovation": "低碳創新協助",
    "Employment practice living wage": "就業實務：基本生活工資",
    "Employment practice unions": "就業實務：工會",
    "Employment policy on discrimination": "就業歧視政策",
    "Employment policy modern slavery": "現代奴役政策",
    "Employment practice equivalent rights outsourcing": "外包同等權利",
    "Employment policy pay scale equity": "薪資尺度公平政策",
    "Tracking pay scale for gender equity": "薪資尺度性別公平追蹤",
    "Employment practice appeal process": "就業申訴程序",
    "Employment practice labour rights": "就業實務：勞動權利",
    "Non-discriminatory admissions policy": "不歧視招生政策",
    "Access to university track underrepresented groups applications": "追蹤代表性不足群體申請",
    "Access to university underrepresented groups recruit": "招收代表性不足群體",
    "Anti-discrimination policies": "反歧視政策",
    "Anti-discrimination policy": "反歧視政策",
    "University diversity officer": "大學多元事務單位／人員",
    "Support for underrepresented groups": "代表性不足群體支持",
    "Accessible facilities": "無障礙設施",
    "Disability support services": "身心障礙支持服務",
    "Disability access scheme": "身心障礙近用方案",
    "Disability accommodation policy": "身心障礙合理調整政策",
    "Anti-harassment policy": "反騷擾政策",
    "Public access to buildings": "建築公共近用",
    "Public access to libraries": "圖書館公共近用",
    "Public access to museums": "博物館公共近用",
    "Public access to green spaces": "綠地公共近用",
    "Arts and heritage contribution": "藝術與遺產貢獻",
    "Record and preserve cultural heritage": "記錄與保存文化遺產",
    "Sustainable practices targets": "永續實務目標",
    "Promote sustainable commuting": "推廣永續通勤",
    "Allow remote working": "允許遠距工作",
    "Affordable housing for employees": "員工可負擔住房",
    "Affordable housing for students": "學生可負擔住房",
    "Pedestrian priority on campus": "校園行人優先",
    "Local authority collaboration regarding planning and development": "與地方主管機關就規劃發展合作",
    "Local authority collab. re: planning redevelopment": "與地方主管機關就規劃發展合作",
    "Planning development - new build standards": "規劃發展－新建標準",
    "Building on brownfield sites": "在棕地興建",
    "Ethical sourcing policy": "倫理採購政策",
    "Policy waste disposal - hazardous materials": "廢棄物處理政策－危害物質",
    "Policy waste disposal - landfill policy": "廢棄物處理政策－掩埋政策",
    "Policy for minimisation of plastic use": "塑膠減量政策",
    "Policy for minimisation of disposable items": "一次性用品減量政策",
    "Disposable policy: extensions to services": "一次性用品政策：延伸至服務",
    "Minimisation policies extended to suppliers": "減量政策延伸至供應商",
    "Waste tracking": "廢棄物追蹤",
    "Local education programmes on climate": "地方氣候教育計畫",
    "Climate Action Plan, shared": "氣候行動計畫（共享）",
    "Co-operative planning for climate change disasters": "氣候變遷災害合作規劃",
    "Inform and support government": "告知並支持政府",
    "Environmental education collaborate with NGO": "與 NGO 環境教育合作",
    "Commitment to carbon neutral university": "碳中和大學承諾",
    "Low-carbon energy tracking": "低碳能源追蹤",
    "Low carbon energy tracking": "低碳能源追蹤",
    "Fresh-water ecosystems (community outreach)": "淡水生態系（社區外展）",
    "Sustainable fisheries (community outreach)": "永續漁業（社區外展）",
    "Overfishing (community outreach)": "過度捕撈（社區外展）",
    "Conservation and sustainable utilisation of the oceans (events)": "海洋保育與永續利用（活動）",
    "Food from aquatic ecosystems (policies)": "水生生態系來源食品（政策）",
    "Maintain ecosystems and their biodiversity (direct work)": "維護生態系及其生物多樣性（直接工作）",
    "Technologies towards aquatic ecosystem damage prevention (direct work)": "水生生態系損害預防技術（直接工作）",
    "Water discharge guidelines and standards": "排水指引與標準",
    "Action plan to reducing plastic waste": "塑膠廢棄物減量行動計畫",
    "Reducing marine pollution (policy)": "減少海洋污染（政策）",
    "Minimizing alteration of aquatic ecosystems (plan)": "最小化水生生態系改變（計畫）",
    "Monitoring the health of aquatic ecosystems": "監測水生生態系健康",
    "Programs towards good aquatic stewardship practices": "優良水域 stewardship 方案",
    "Programmes towards good aquatic stewardship practices": "優良水域 stewardship 方案",
    "Collaboration for shared aquatic ecosystems": "共享水生生態系合作",
    "Watershed management strategy": "集水區管理策略",
    "Events about sustainable use of land": "土地永續利用相關活動",
    "Sustainably farmed food on campus": "校園永續農產食品",
    "Maintain and extend current ecosystems' biodiversity": "維護並擴展現行生態系生物多樣性",
    "Educational programmes on ecosystems": "生態系教育計畫",
    "Sustainable management of land for agriculture (educational outreach)": "農業土地永續管理（教育外展）",
    "Sustainable management of land for tourism (educational outreach)": "觀光土地永續管理（教育外展）",
    "Sustainable use, conservation and restoration of land (policy)": "土地永續利用、保育與復育（政策）",
    "Monitoring IUCN and other conservation species (policies)": "監測 IUCN 及其他保育物種（政策）",
    "Local biodiversity included in planning and development": "規劃發展納入地方生物多樣性",
    "Alien species impact reduction (policies)": "外來種衝擊減量（政策）",
    "Collaboration for shared land ecosystems": "共享陸域生態系合作",
    "Policy on plastic waste reduction": "塑膠廢棄物減量政策",
    "Policy on hazardous waste disposal": "危害廢棄物處理政策",
    "Elected representation": "選舉代表",
    "Students' union": "學生會",
    "Identify and engage with local stakeholders": "識別並與地方利害關係人互動",
    "Participatory bodies for stakeholder engagement": "利害關係人參與機制",
    "University principles on corruption and bribery": "反貪腐與賄賂原則",
    "Academic freedom policy": "學術自由政策",
    "Publish financial data": "公開財務資料",
    "Provide expert advice to government": "向政府提供專家建議",
    "Policy- and lawmakers outreach and education": "政策與立法者外展與教育",
    "Participation in government research": "參與政府研究",
    "Neutral platform to discuss issues": "中立討論平台",
    "Relationships with regional NGOs and government for SDG policy": "與區域 NGO 及政府之 SDG 政策關係",
    "Cross sectoral dialogue about SDGs": "SDG 跨部門對話",
    "International collaboration data gathering for SDG": "SDG 國際資料蒐集合作",
    "Collaboration for SDG best practice": "SDG 最佳實務合作",
    "Collaboration with NGOs for SDGs": "與 NGO 合作推動 SDG",
    "Education for SDGs commitment to meaningful education": "SDG 有意義教育之承諾",
    "Education for SDGs specific courses on sustainability": "SDG 永續專責課程",
    "Education for SDGs in the wider community": "更廣泛社區之 SDG 教育",
    "Sustainable Literacy": "永續素養",
    "Publication of SDG reports - per SDG": "發布 SDG 報告－各 SDG",
    "Students receiving financial aid": "獲得財務援助之學生",
    "Proportion of women first- generation": "第一代女性比例",
    "Proportion of students work with placements": "有實習經驗之學生比例",
    "First generation students": "第一代大學生",
    "Research income from industry and commerce by subject area: Arts & Humanities / Social Sciences": "產業與商業研究收入（依領域）：藝術人文／社會科學",
    "Number of academic staff by subject area: Arts & Humanities / Social Sciences": "學術人員人數（依領域）：藝術人文／社會科學",
}


def _questionize_zh_body(title_zh: str, en_full: str) -> str:
    """Build ZH as title + 貴校是否…？ from known INDICATORS or generic."""
    ind_map = {norm_key(k): v for k, v in INDICATORS.items()}
    nk = norm_key(en_full)
    if nk in ind_map:
        return ind_map[nk]
    # match INDICATORS by first line
    first = clean_text(en_full).split("\n")[0].strip()
    for k, v in INDICATORS.items():
        if clean_text(k).split("\n")[0].strip() == first:
            return v
    # generic: title only if no body
    lines = [ln for ln in clean_text(en_full).split("\n") if ln.strip()]
    if len(lines) <= 1:
        return title_zh
    # extract bullet options after body for ZH listing
    body_lines = lines[1:]
    bullets = []
    prose = []
    for ln in body_lines:
        s = ln.strip().lstrip("•").strip()
        if not s:
            continue
        # option-like short lines often start after main prose
        if s.lower() in TR:
            bullets.append(TR[s.lower()] if s.lower() in TR else TR.get(s, s))
        elif s in TR:
            bullets.append(TR[s])
        elif len(s) < 60 and not s[0].isupper() == False and s.lower() in (
            "whole university", "partial measurement", "local", "regional", "national", "global",
            "ad hoc", "on-going", "smoking-free campus", "smoking in designated areas",
        ):
            bullets.append(TR.get(s, TR.get(s.lower(), s)))
        else:
            prose.append(s)
    zh_body = ""
    if prose:
        # if INDICATORS didn't match, keep a short question placeholder using title
        zh_body = f"貴校是否符合「{title_zh}」之相關要求？"
    parts = [title_zh]
    if zh_body:
        parts.append(zh_body)
    for b in bullets:
        # translate common options
        bb = TR.get(b, TR.get(b.lower(), b))
        parts.append(f"• {bb}")
    return "\n".join(parts)


def translate(en: str) -> str:
    en_c = clean_text(en)
    if not en_c:
        return ""
    # exact short
    if en_c in TR:
        return TR[en_c]
    nk = norm_key(en_c)
    if nk in TR:
        return TR[nk]
    ind_map = {norm_key(k): v for k, v in INDICATORS.items()}
    if nk in ind_map:
        return ind_map[nk]
    # SDG report fuzzy
    m = re.search(r"Publish progress against\s+against\s+SDG(\d+)", en_c, re.I)
    if not m:
        m = re.search(r"Publish progress against\s+SDG(\d+)", en_c, re.I)
    if m and "Publication of SDG reports" in en_c:
        i = m.group(1)
        return f"發布 SDG 報告－各 SDG\n貴校是否單獨或於年報中公布 SDG{i} 之進展？"
    # title-based + indicator body match
    first = en_c.split("\n")[0].strip()
    first = re.sub(r"\s+", " ", first)
    # normalize apostrophes in first line for lookup
    first_n = first.replace("'", "'").replace("'", "'")
    title_zh = TITLE_ZH.get(first) or TITLE_ZH.get(first_n)
    if not title_zh:
        # try women's curly apostrophe variants already cleaned
        for k, v in TITLE_ZH.items():
            if norm_key(k) == norm_key(first):
                title_zh = v
                break
    if title_zh:
        if "\n" not in en_c:
            return title_zh
        return _questionize_zh_body(title_zh, en_c)
    # fallback: mark for review
    return f"【待補中譯】{en_c}"

def copy_cell_style(src, dst):
    if src.has_style:
        dst.font = copy(src.font)
        dst.border = copy(src.border)
        dst.fill = copy(src.fill)
        dst.number_format = src.number_format
        dst.protection = copy(src.protection)
        dst.alignment = copy(src.alignment)


def unmerge_all(ws):
    """Merged ranges break insert_cols / bilingual column writes; clear them first."""
    for rng in list(ws.merged_cells.ranges):
        ws.unmerge_cells(str(rng))


def process_sdg_sheet(ws):
    # Insert column D for Chinese (after C English)
    # Current: A Type, B Ref, C Metric, D Value, E Yes/No, F Evidence, G Public
    # New:     A Type, B Ref, C English, D 中文, E Value, F Yes/No, G Evidence, H Public
    unmerge_all(ws)
    ws.insert_cols(4)  # new D

    # Title row 1
    title = ws["A1"].value
    if title:
        ws["A1"] = clean_text(str(title))
        # optional Chinese SDG title beside
        sdg_titles = {
            "SDG1: No Poverty": "SDG1：消除貧窮",
            "SDG2: Zero Hunger": "SDG2：消除飢餓",
            "SDG3: Good Health and Well-being": "SDG3：良好健康與福祉",
            "SDG4: Quality Education": "SDG4：優質教育",
            "SDG5: Gender Equality": "SDG5：性別平等",
            "SDG6: Clean Water and Sanitation": "SDG6：潔淨水與衛生",
            "SDG7: Affordable and Clean Energy": "SDG7：可負擔潔淨能源",
            "SDG8: Decent Work and Economic Growth": "SDG8：尊嚴勞動與經濟成長",
            "SDG9: Industry, Innovation and Infrastructure": "SDG9：產業、創新與基礎設施",
            "SDG10: Reduced Inequalities": "SDG10：減少不平等",
            "SDG11: Sustainable Cities and Communities": "SDG11：永續城市與社區",
            "SDG12: Responsible Consumption and Production": "SDG12：負責任消費與生產",
            "SDG13: Climate Action": "SDG13：氣候行動",
            "SDG14: Life Below Water": "SDG14：水下生命",
            "SDG15: Life on Land": "SDG15：陸域生命",
            "SDG16: Peace, Justice and Strong Institutions": "SDG16：和平、正義與健全制度",
            "SDG17: Partnerships for the Goals": "SDG17：促進目標實現的夥伴關係",
        }
        t = clean_text(str(title))
        if t in sdg_titles:
            ws["D1"] = sdg_titles[t]

    # Header row 2
    headers = {
        "A": "Type",
        "B": "Metric and indicator reference",
        "C": "English (Question)",
        "D": "中文（提問）",
        "E": "Value\n(for continuous data)",
        "F": "Yes/No",
        "G": "Evidence1",
        "H": "Public (Yes/No)",
    }
    # detect header row
    header_row = 2
    if ws["A2"].value and str(ws["A2"].value).strip() == "Type":
        header_row = 2
    for col, val in headers.items():
        ws[f"{col}{header_row}"] = val

    wrap = Alignment(wrap_text=True, vertical="top")
    for row in range(header_row + 1, ws.max_row + 1):
        c_cell = ws.cell(row=row, column=3)
        raw = c_cell.value
        if raw is None or str(raw).strip() == "":
            continue
        en_q = to_question_en(str(raw))
        zh = translate(str(raw))
        # if zh still has English body as original structure, also lightly questionize? already in INDICATORS
        c_cell.value = en_q
        c_cell.alignment = wrap
        d_cell = ws.cell(row=row, column=4)
        d_cell.value = zh
        d_cell.alignment = wrap

    # column widths
    ws.column_dimensions["C"].width = 55
    ws.column_dimensions["D"].width = 55


def process_example_sheet(ws):
    unmerge_all(ws)
    ws.insert_cols(4)
    # headers row 1
    ws["C1"] = "English (Question)"
    ws["D1"] = "中文（提問）"
    # shift note: original D Value -> now E etc already by insert
    for row in range(2, ws.max_row + 1):
        raw = ws.cell(row=row, column=3).value
        if not raw:
            continue
        en_q = to_question_en(str(raw))
        zh = translate(str(raw))
        ws.cell(row=row, column=3).value = en_q
        ws.cell(row=row, column=3).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=row, column=4).value = zh
        ws.cell(row=row, column=4).alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["C"].width = 55
    ws.column_dimensions["D"].width = 55


def process_summary_sheet(ws):
    # summary: A ref, B Metric/Indicator, C Question format, D Evidence, E Policy dates
    # Insert Chinese after B
    unmerge_all(ws)
    ws.insert_cols(3)  # new C = 中文
    ws["B1"] = "English (Question)"
    ws["C1"] = "中文（提問）"
    # old C was Question format -> now D
    ws["D1"] = "Question format"
    ws["E1"] = "Evidence Required"
    ws["F1"] = "Policy dates required"
    for row in range(2, ws.max_row + 1):
        raw = ws.cell(row=row, column=2).value
        if not raw:
            continue
        text = clean_text(str(raw))
        # section headers like SDG17: ...
        if re.match(r"^SDG\d+", text) and "\n" not in text and "." not in text.split()[0]:
            # keep EN, add ZH section if known
            ws.cell(row=row, column=2).value = text
            continue
        # metric-only titles (no indicator code detail with newline sometimes)
        en_q = to_question_en(text)
        zh = translate(text)
        # summary often concatenates title+desc - try translate
        if zh.startswith("【待補中譯】"):
            # try first line only for metric headers
            first = text.split("\n")[0].strip()
            if first in TR:
                rest = "\n".join(text.split("\n")[1:]).strip()
                if rest:
                    zh2 = translate(text)  # already failed
                    # try indicator map with cleaned
                    zh = ind_map_lookup(text)
                else:
                    zh = TR[first]
            else:
                zh = ind_map_lookup(text)
        ws.cell(row=row, column=2).value = en_q
        ws.cell(row=row, column=2).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=row, column=3).value = zh
        ws.cell(row=row, column=3).alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["B"].width = 55
    ws.column_dimensions["C"].width = 55


def ind_map_lookup(text: str) -> str:
    nk = norm_key(text)
    ind_map = {norm_key(k): v for k, v in INDICATORS.items()}
    if nk in ind_map:
        return ind_map[nk]
    # try match by first line + start of second
    lines = clean_text(text).split("\n")
    if len(lines) >= 2:
        for k, v in INDICATORS.items():
            kl = clean_text(k).split("\n")
            if kl[0].strip() == lines[0].strip() and len(kl) > 1:
                # fuzzy if second line starts similarly
                if kl[1][:40] == lines[1][:40] or norm_key(kl[1])[:60] == norm_key(lines[1])[:60]:
                    return v
    if lines[0] in TR:
        return TR[lines[0]]
    return f"【待補中譯】{clean_text(text)}"


def main():
    wb = load_workbook(SRC)
    for name in wb.sheetnames:
        ws = wb[name]
        if name.strip().startswith("SDG"):
            process_sdg_sheet(ws)
        elif name == "example":
            process_example_sheet(ws)
        elif name == "summary":
            process_summary_sheet(ws)
    wb.save(OUT)
    # report missing translations
    missing = []
    for name in wb.sheetnames:
        ws = wb[name]
        # Chinese col: D for SDG/example, C for summary
        col = 3 if name == "summary" else 4
        if name == "summary":
            col = 3
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row, min_col=col, max_col=col):
            v = row[0].value
            if isinstance(v, str) and v.startswith("【待補中譯】"):
                missing.append((name, row[0].coordinate, v[:120]))
    print("OUT:", OUT)
    print("Missing:", len(missing))
    for m in missing[:80]:
        print(m)


if __name__ == "__main__":
    main()
