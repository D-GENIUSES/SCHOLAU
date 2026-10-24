#!/usr/bin/env python
# coding: utf-8

# # Welcome to Problem Solving in Python

# First, let me introduce you to a built-in function for displaying data/output. The **print()** function can display strings and integer data types.

# In[1]:


# To display strings, you have to enclose them in single or double quotes. Using double quotes promotes consistency 
print("Hello world")


# In[2]:


# Integers on the other hand don't need to be enclosed in quotation marks
print(5)


# Now, try displaying your Name and your Matric Number. Feel free to play around with the print() function

# In[ ]:





# ## Problem 1: Writing a Program to Calculate the Factorial of a Given Number
# Notebooks allow you to write your code blocks in cells, helping you debug your lines of code as you build them.
# We will build out our codes line by line, and when we have tested their correctness, we'll merge them in a cell. So let's get started.

# If you haven't gotten conversant with programming terminologies like **Variables** by now, this would be a good time to pause and read up on it before proceeding.

# **Step 1: Declaring Variables and Receiving Input from User**
# 
# Since we want to write a program to calculate the factorial of any given number, we need to ask the user to provide any number > 0. We also need to keep in mind the type of data we want to receive from the user.
# 
# If you recall, the function used to display output is the **print( )** function. Now let's consider the function used to receive input from users - The **input( )** function.

# In[3]:


n = int(input("input any number above 0 "))


# Just like your BODMAS, the computer also has an order of operation. The <mark style="background-color: #d3d3d3">=</mark> means an assignment operation. The operation on the rigt hand side will be carried out first, and the value of the operation will be stored in the variable *n* on the left hand side.
# 
# On the RHS, the operation in the bracket will be performed first - <mark style="background-color: #d3d3d3">input("input any number above 0 ")</mark> - which receives an imput from the user by prompting the user using the the statement enclosed in quotation marks.
# 
# Afterwards, the <mark style="background-color: #d3d3d3">int( )</mark> function is used to *cast* whatever value received from the user into an integer data type.
# 
# Now would be a good time to pause and read up on **data types**

# In[4]:


# We declare and initialize another variable to hold the result of our operations. It is initially assigned the value 1
result = 1


# **Step 2: Using a Loop to Calculate Factorial**
# 
# To find the factorial, we use a while loop to multiply numbers down to 1.

# In[5]:


while n > 1:
    result = result * n # Multiply current number with result
    n = n - 1 # Reduce the number by 1


# **Step 3: Display the Result**

# In[6]:


print(result)


# **Full Code:**

# In[7]:


n = int(input("input any number above 0 "))
initial_n = n # Store original number for display
result = 1
while n > 1:
    result = result * n
    n = n - 1
print("The factorial of "+ str(initial_n) + " is " + str(result))


# **Try It Yourself:** Run the code and test with different numbers!

# In[ ]:





# ## Problem 2: Finding Quotient and Remainer Given 2 Numbers
# Given natural numbers *x (x≥0)* and *y (y>0)*, write an algorithm to compute the quotient (q) and (r) remainder when *x* is divided by *y*.
# Assume that only addition and subtractions are available as primitive arithmetic operations.
# 
# Tip: Consider the properties of quotient (q) and remainer (r) 
# Obtained after dividing *x* by *y*. 

# **Step 1: Taking Input**

# In[8]:


x = int(input("Input first number: "))
y = int(input("Input second number: "))
q = 0 # Start quotient at 0


# **Step 2: Using Subtraction to Find Quotient**
# 
# We keep subtracting <mark style="background-color: #d3d3d3">*y*</mark> from <mark style="background-color: #d3d3d3">*x*</mark> until <mark style="background-color: #d3d3d3">*x*</mark> is smaller than <mark style="background-color: #d3d3d3">*y*</mark>, counting the number of times we subtract.

# In[9]:


while x >= y:
    x = x - y
    q = q + 1 # Increase quotient count


# **Step 3: Assign the Remainder**
# 
# After the loop, whatever is left in <mark style="background-color: #d3d3d3">*x*</mark> is the remainder.

# In[10]:


r = x


# **Step 4: Display the Result**

# In[11]:


print(q, r)


# **Full Code:**

# In[12]:


x = int(input("Enter first number: "))
y = int(input("Enter second number: "))
q = 0
while x >= y:
    x = x - y
    q = q + 1
r = x
print(f"Quotient: {q}, Remainder: {r}")


# **Try It Yourself:** Try different values for x and y and observe the output!

# In[ ]:




